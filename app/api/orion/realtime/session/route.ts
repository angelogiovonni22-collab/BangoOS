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
const TASK_AGENT_TOOL_NAME = "orion_task_agent";

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
      params: { type: "object", properties, required, additionalProperties: false },
    },
    required: ["params"],
    additionalProperties: false,
  };
}

function realtimeBosTools() {
  const canonicalTools = buildUniversalBosToolCatalog().map((tool) => ({ type: tool.type, name: tool.name, description: tool.description, parameters: tool.parameters }));

  return [
    ...canonicalTools,
    {
      type: "function" as const,
      name: TASK_AGENT_TOOL_NAME,
      description: "Run a persistent multi-turn Orion task and control a live BOS form. Use this for workflows that require a real conversation across multiple fields or steps instead of treating each utterance as an isolated command. For estimates, start the task first; Orion will open /estimates/new, then inspect and visually patch the live form as the user provides actual values. Never save a field label such as 'customer name' as the field value; if the user names which field they want to provide, ask for its actual value.",
      parameters: wrappedToolParameters({
        action: {
          type: "string",
          enum: ["start", "get", "update", "inspect_form", "patch_form", "add_line_item", "save_form", "cancel"],
          description: "Task lifecycle or live-form operation.",
        },
        taskType: {
          type: "string",
          enum: ["estimate", "customer", "project", "invoice", "schedule", "generic"],
          description: "The active business task type. Required when starting a task.",
        },
        goal: { type: "string", description: "The user's natural-language goal for the task." },
        fields: {
          type: "object",
          description: "Actual semantic field values to remember or visually apply. Estimate fields include title, customer, project, issueDate, expirationDate, preparedBy, status, description, discountType, discountValue, taxRatePercent, additionalFee, internalNotes, customerNotes, scopeInclusions, scopeExclusions, terms, and paymentTerms.",
          additionalProperties: { type: ["string", "number"] },
        },
        lineItem: {
          type: "object",
          description: "One estimate line item. Supported keys: itemCode, category, description, quantity, unit, unitCost, markupPercent, notes.",
          additionalProperties: { type: ["string", "number"] },
        },
        saveMode: { type: "string", enum: ["draft", "continue"], description: "How to save the live form after the user approves saving." },
      }, ["action"]),
    },
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
        entityType: { type: "string", enum: ["customer", "project", "estimate", "invoice"], description: "The BOS record type to resolve." },
        phrase: { type: "string", description: "The customer name, project name, estimate title/number, or invoice title/number the user spoke." },
      }, ["entityType", "phrase"]),
    },
    {
      type: "function" as const,
      name: RESEARCH_TOOL_NAME,
      description: "Answer questions that need current external information or web research. Use this for current news, regulations, market information, businesses, products, or anything where up-to-date web information is needed. Do not use it for BOS company actions when a canonical BOS tool applies.",
      parameters: wrappedToolParameters({ query: { type: "string", description: "The complete research question to answer using Orion general intelligence and web search." } }, ["query"]),
    },
    {
      type: "function" as const,
      name: CONFIRM_TOOL_NAME,
      description: "Execute a previously requested BOS action only after the user has explicitly confirmed it in the current conversation. Use the exact confirmationToken returned by the prior function output.",
      parameters: wrappedToolParameters({ confirmationToken: { type: "string", description: "Signed short-lived confirmation token returned by the pending BOS action." } }, ["confirmationToken"]),
    },
  ];
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    if (!isOrionVoiceAutomationEnabled()) {
      return NextResponse.json({ ok: false, error: ORION_VOICE_FREEZE_MESSAGE, statusCategory: "voice_automation_paused" }, { status: 503 });
    }

    const apiKey = openAIKey();
    if (!apiKey || process.env.ORION_REALTIME_ENABLED === "0") {
      return NextResponse.json({ ok: false, error: "Orion Realtime voice is not configured yet.", statusCategory: "realtime_unavailable" }, { status: 503 });
    }

    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ ok: false, error: "Supabase is unavailable." }, { status: 503 });

    const workspace = await resolveWorkspaceContext(supabase);
    if (!workspace.context) {
      return NextResponse.json({
        ok: false,
        error: workspace.errorMessage || "Workspace context is unavailable.",
        statusCategory: workspace.errorCode === "unauthenticated" ? "authentication_required" : "permission_denied",
      }, { status: workspace.errorCode === "unauthenticated" ? 401 : 403 });
    }

    const body = await req.json() as { sdp?: unknown; voice?: unknown };
    if (typeof body.sdp !== "string" || !body.sdp.trim()) return NextResponse.json({ ok: false, error: "sdp is required." }, { status: 400 });

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
        "You are Orion, the realtime conversational operating intelligence for BangoOS.",
        "Speak naturally, briefly, confidently, and conversationally. The user should be able to talk to you the way they talk to a capable human assistant.",
        "Do not force command syntax. Interpret ordinary language, corrections, pronouns, short answers, interruptions, and follow-up statements in the context of the active conversation and task.",
        "Wake behavior: at the beginning of a new Realtime conversation, remain dormant until the user directly wakes or addresses you with Hey Orion, Okay Orion, Orion, or a clearly equivalent direct address.",
        "The wake phrase and request may be in the same utterance. Process both immediately.",
        "After awakened, remain active for the rest of that Realtime conversation. Do not require another wake phrase for follow-ups.",
        "If you ask a question, the next user utterance is normally the answer to that question, even when it is only a name, number, phrase, yes/no answer, or correction.",
        "Never interpret the name of a field as the value for that field. Example: if you ask what the user wants to start with and they say 'customer name', that means they want to provide the customer field; ask 'What's the customer's name?' Do not save the literal words 'customer name'.",
        "Maintain task continuity. If the user is creating an estimate, every later answer belongs to that estimate until the task is completed, cancelled, or clearly changed.",
        `Use ${TASK_AGENT_TOOL_NAME} for multi-step create/edit workflows that should be visible on screen. Start the task once, then inspect/patch the live form as actual information becomes available.`,
        "For a new estimate: call orion_task_agent with action=start and taskType=estimate. This opens the New Estimate page. Then ask naturally for missing information, usually customer, estimate/project title or scope, line items and pricing, and any dates/terms the user wants. Patch each actual value into the visible form as soon as it is known so the user can watch the form fill in live.",
        "Do not ask the user to recite every optional estimate field. Ask only what is necessary or useful, infer safe defaults already present on the form, and let the user volunteer several details in one sentence. If they give multiple values at once, apply all of them in one patch.",
        "When the user gives a customer or project name for the estimate, visually select the matching option. If there is no matching option, tell the user and ask whether they want to create/select another record rather than inventing one.",
        "For estimate line items, convert natural descriptions into structured line items. Example: '900 square feet of flooring at 7.50 a foot with 20 percent markup' becomes description=Flooring, quantity=900, unit=square_foot, unitCost=7.50, markupPercent=20.",
        "If the user corrects something, update the task memory and visible form immediately. A later correction overrides the earlier value.",
        "Before saving a multi-step form, inspect it, summarize any important missing required information, and ask for confirmation if saving would commit or leave the current screen. Do not claim saved until the tool output confirms the save was requested/succeeded.",
        "Conversation-first routing rule: greetings, capability checks, pleasantries, and questions about Orion itself must be answered directly and MUST NOT call a BOS tool.",
        "Only call a BOS tool when the user clearly asks to read, navigate, create, update, execute, or otherwise operate on BOS data or a BOS screen.",
        "Navigation tools require explicit navigation intent. Never navigate merely because a module name is loosely related to the user's words.",
        "If uncertain whether the user wants an action or conversation, ask one short clarification instead of guessing.",
        `Use ${CONTEXT_TOOL_NAME} whenever current-page context could supply a missing record after clear BOS intent is established.`,
        `Use ${RESOLVE_ENTITY_TOOL_NAME} to translate spoken customer/project/estimate/invoice names or numbers into canonical BOS ids when an id-based BOS tool requires one. Never invent an id.`,
        "When entity resolution returns multiple candidates, ask the user which one they mean.",
        `Use ${RESEARCH_TOOL_NAME} for current external information.`,
        "A tool request is not proof that an action succeeded. Wait for its function output before claiming success.",
        "If a function output says confirmationRequired=true, ask for explicit confirmation and remember its confirmationToken.",
        `Only after clear confirmation call ${CONFIRM_TOOL_NAME} with the exact token.`,
        "If the user cancels or changes their mind, do not execute the pending action.",
        "If validation fails, ask naturally for the missing information rather than reading a technical error.",
        `Current BOS company id: ${workspace.context.companyId}.`,
      ].join("\n"),
      audio: {
        input: {
          noise_reduction: { type: "far_field" },
          transcription: {
            model: "gpt-4o-mini-transcribe",
            language: "en",
            prompt: "BangoOS construction terminology, customer names, project names, estimates, invoices, crews, change orders, line items, quantities, square feet, linear feet, markup, tax, scope, confirm, cancel.",
          },
          turn_detection: { type: "semantic_vad", eagerness: "high", create_response: true, interrupt_response: true },
        },
        output: { voice, speed: 1 },
      },
      tools,
      tool_choice: "auto",
    })], { type: "application/json" }), "session.json");

    const openAIResponse = await fetch(OPENAI_REALTIME_CALLS_URL, { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form, cache: "no-store" });
    const answerSdp = await openAIResponse.text();
    if (!openAIResponse.ok || !answerSdp.trim()) {
      return NextResponse.json({ ok: false, error: answerSdp.trim() || "OpenAI Realtime session creation failed.", statusCategory: "realtime_connection_failed" }, { status: openAIResponse.status || 502 });
    }

    return NextResponse.json({ ok: true, sdp: answerSdp, model: modelConfig.realtimeModel, voice, toolCount: tools.length });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to create Orion Realtime session.", statusCategory: "realtime_error" }, { status: 500 });
  }
}
