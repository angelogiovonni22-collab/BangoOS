import { NextRequest, NextResponse } from "next/server";
import { buildOrionSystemPolicy, buildUniversalBosToolCatalog, getOrionModelConfig } from "@/lib/orion/intelligence";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

const OPENAI_REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";
const DEFAULT_REALTIME_VOICE = "marin";

function openAIKey() {
  const key = process.env.OPENAI_API_KEY;
  return typeof key === "string" && key.trim() ? key.trim() : null;
}

function realtimeVoice(requested: unknown) {
  if (typeof requested === "string" && requested.trim()) return requested.trim();
  const configured = process.env.ORION_REALTIME_VOICE;
  return typeof configured === "string" && configured.trim() ? configured.trim() : DEFAULT_REALTIME_VOICE;
}

function realtimeBosTools() {
  return buildUniversalBosToolCatalog().map((tool) => ({
    type: tool.type,
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const apiKey = openAIKey();
    if (!apiKey || process.env.ORION_REALTIME_ENABLED === "0") {
      return NextResponse.json({
        ok: false,
        error: "Orion Realtime voice is not configured yet.",
        statusCategory: "realtime_unavailable",
      }, { status: 503 });
    }

    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Supabase is unavailable." }, { status: 503 });
    }

    const workspace = await resolveWorkspaceContext(supabase);
    if (!workspace.context) {
      return NextResponse.json({
        ok: false,
        error: workspace.errorMessage || "Workspace context is unavailable.",
        statusCategory: workspace.errorCode === "unauthenticated" ? "authentication_required" : "permission_denied",
      }, { status: workspace.errorCode === "unauthenticated" ? 401 : 403 });
    }

    const body = await req.json() as { sdp?: unknown; voice?: unknown };
    if (typeof body.sdp !== "string" || !body.sdp.trim()) {
      return NextResponse.json({ ok: false, error: "sdp is required." }, { status: 400 });
    }

    const modelConfig = getOrionModelConfig();
    const voice = realtimeVoice(body.voice);
    const tools = realtimeBosTools();
    const form = new FormData();
    form.set("sdp", new Blob([body.sdp], { type: "application/sdp" }), "offer.sdp");
    form.set("session", new Blob([JSON.stringify({
      type: "realtime",
      model: modelConfig.realtimeModel,
      output_modalities: ["audio"],
      instructions: [
        buildOrionSystemPolicy(),
        "You are speaking with the user in realtime voice.",
        "Be concise, warm, natural, and conversational.",
        "Allow natural interruptions and do not force the user to repeat a wake phrase during an active conversation.",
        "Use BOS function tools for company navigation, reads, and operational actions whenever a canonical tool applies.",
        "A tool request is not proof that an action succeeded. Wait for the function output before claiming success.",
        "If a function output says confirmationRequired=true, ask the user for explicit confirmation. Do not claim the action ran.",
        "If a function output reports validation failure, ask naturally for the missing information instead of presenting a generic error.",
        `Current BOS company id: ${workspace.context.companyId}.`,
      ].join("\n"),
      audio: {
        input: {
          noise_reduction: { type: "far_field" },
          turn_detection: {
            type: "semantic_vad",
            eagerness: "high",
            create_response: true,
            interrupt_response: true,
          },
        },
        output: {
          voice,
          speed: 1,
        },
      },
      tools,
      tool_choice: "auto",
    })], { type: "application/json" }), "session.json");

    const openAIResponse = await fetch(OPENAI_REALTIME_CALLS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      cache: "no-store",
    });

    const answerSdp = await openAIResponse.text();
    if (!openAIResponse.ok || !answerSdp.trim()) {
      return NextResponse.json({
        ok: false,
        error: answerSdp.trim() || "OpenAI Realtime session creation failed.",
        statusCategory: "realtime_connection_failed",
      }, { status: openAIResponse.status || 502 });
    }

    return NextResponse.json({
      ok: true,
      sdp: answerSdp,
      model: modelConfig.realtimeModel,
      voice,
      toolCount: tools.length,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Unable to create Orion Realtime session.",
      statusCategory: "realtime_error",
    }, { status: 500 });
  }
}
