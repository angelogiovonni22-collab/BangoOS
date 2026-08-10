import { NextRequest, NextResponse } from "next/server";
import { buildOrionSystemPolicy, buildUniversalBosToolCatalog, getOrionModelConfig } from "@/lib/orion/intelligence";
import { isOrionVoiceAutomationEnabled, ORION_VOICE_FREEZE_MESSAGE } from "@/lib/orion/runtime-config";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

const OPENAI_REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";
const DEFAULT_REALTIME_VOICE = "marin";
const CONFIRM_TOOL_NAME = "bos_confirm_pending_action";
const RESEARCH_TOOL_NAME = "orion_web_research";
const CONTEXT_TOOL_NAME = "orion_current_context";
const RESOLVE_ENTITY_TOOL_NAME = "orion_resolve_entity";

function openAIKey() {
  const key = process.env.OPENAI_API_KEY;
  return typeof key === "string" && key.trim() ? key.trim() : null;
}

function realtimeVoice(requested: unknown) {
  if (typeof requested === "string" && requested.trim()) return requested.trim();
  const configured = process.env.ORION_REALTIME_VOICE;
  return typeof configured === "string" && configured.trim() ? configured.trim() : DEFAULT_REALTIME_VOICE;
}

function wrappedToolParameters(properties: Record<string, unknown>, required: string[] = []) {
  return {
    type: "object",
    properties: {
      params: {
        type: "object",
        properties,
        required,
        additionalProperties: false,
      },
    },
    required: ["params"],
    additionalProperties: false,
  };
}

function realtimeBosTools() {
  const canonicalTools = buildUniversalBosToolCatalog().map((tool) => ({
    type: tool.type,
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));

  return [
    ...canonicalTools,
    {
      type: "function" as const,
      name: CONTEXT_TOOL_NAME,
      description: "Read the user's current BOS page and active project/customer/estimate/invoice identifiers. Use this before asking the user which record they mean when the current page may already provide that context.",
      parameters: wrappedToolParameters({}),
    },
    {
      type: "function" as const,
      name: RESOLVE_ENTITY_TOOL_NAME,
      description: "Resolve a spoken BOS customer, project, estimate, or invoice name/number to a company-scoped record id. Use this whenever the user gives a human name or number but a BOS action requires an id. If multiple candidates are returned, ask the user to choose rather than guessing.",
      parameters: wrappedToolParameters({
        entityType: {
          type: "string",
          enum: ["customer", "project", "estimate", "invoice"],
          description: "The BOS record type to resolve.",
        },
        phrase: {
          type: "string",
          description: "The customer name, project name, estimate title/number, or invoice title/number the user spoke.",
        },
      }, ["entityType", "phrase"]),
    },
    {
      type: "function" as const,
      name: RESEARCH_TOOL_NAME,
      description: "Answer questions that need current external information or web research. Use this for current news, weather-like external facts, regulations, market information, businesses, products, or anything where up-to-date web information is needed. Do not use it for BOS company actions when a canonical BOS tool applies.",
      parameters: wrappedToolParameters({
        query: {
          type: "string",
          description: "The complete research question to answer using Orion general intelligence and web search.",
        },
      }, ["query"]),
    },
    {
      type: "function" as const,
      name: CONFIRM_TOOL_NAME,
      description: "Execute a previously requested BOS action only after the user has explicitly confirmed it in the current conversation. Use the exact confirmationToken returned by the prior function output.",
      parameters: wrappedToolParameters({
        confirmationToken: {
          type: "string",
          description: "Signed short-lived confirmation token returned by the pending BOS action.",
        },
      }, ["confirmationToken"]),
    },
  ];
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    if (!isOrionVoiceAutomationEnabled()) {
      return NextResponse.json({
        ok: false,
        error: ORION_VOICE_FREEZE_MESSAGE,
        statusCategory: "voice_automation_paused",
      }, { status: 503 });
    }

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
        "Conversation-first routing rule: ordinary conversation, greetings, capability checks, acknowledgements, pleasantries, and questions about Orion itself must be answered directly and MUST NOT call a BOS tool.",
        "Examples that must stay conversational include: can you hear me, are you there, how are you, what can you do, thank you, hello, and similar social or capability-check phrases.",
        "Only call a BOS tool when the user clearly asks to read, navigate, create, update, execute, or otherwise operate on BOS data or a BOS screen. Do not infer a BOS action from unrelated words or weak semantic similarity.",
        "Navigation tools require explicit navigation intent such as open, go to, take me to, show me the page, or navigate to. Never navigate merely because a module name is loosely related to the user's words.",
        "If you are uncertain whether the user wants a BOS action or conversation, answer conversationally or ask a short clarification instead of calling a BOS tool.",
        "Use BOS function tools for company navigation, reads, and operational actions only when the user's request has clear BOS intent and a canonical tool applies.",
        `Use ${CONTEXT_TOOL_NAME} whenever current-page context could supply a missing project, customer, estimate, or invoice id after clear BOS intent is established.`,
        `Use ${RESOLVE_ENTITY_TOOL_NAME} to translate spoken customer/project/estimate/invoice names or numbers into canonical BOS ids before calling id-based BOS tools. Never invent an id.`,
        "When entity resolution returns more than one candidate, ask the user a short natural clarification question and keep listening for the answer.",
        `Use ${RESEARCH_TOOL_NAME} when the user asks for current external information, web research, or facts that should not be guessed from model memory.`,
        "For ordinary timeless questions that you can answer confidently without current information, answer conversationally without calling a tool.",
        "A tool request is not proof that an action succeeded. Wait for the function output before claiming success.",
        "If a function output says confirmationRequired=true, ask the user for explicit confirmation and remember its confirmationToken. Do not claim the action ran.",
        `Only after the user clearly confirms that pending action, call ${CONFIRM_TOOL_NAME} with the exact confirmationToken.`,
        "If the user cancels or changes their mind, do not call the confirmation tool.",
        "If a function output reports validation failure, ask naturally for the missing information instead of presenting a generic error.",
        `Current BOS company id: ${workspace.context.companyId}.`,
      ].join("\n"),
      audio: {
        input: {
          noise_reduction: { type: "far_field" },
          transcription: {
            model: "gpt-4o-mini-transcribe",
            language: "en",
            prompt: "Bango Operating System construction terminology, customer names, project names, estimates, invoices, crews, change orders, daily reports, confirm, cancel.",
          },
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
