import { NextRequest, NextResponse } from "next/server";
import { buildOrionSystemPolicy, getOrionModelConfig } from "@/lib/orion/intelligence";
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
        "Do not claim that you changed BOS data unless a BOS command tool has actually completed successfully.",
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
      tool_choice: "none",
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
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Unable to create Orion Realtime session.",
      statusCategory: "realtime_error",
    }, { status: 500 });
  }
}
