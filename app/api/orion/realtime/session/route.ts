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
const UI_OPERATOR_TOOL_NAME = "orion_ui_operator";

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
      name: UI_OPERATOR_TOOL_NAME,
      description: "Observe and operate the actual visible BangoOS interface using semantic control references rather than pixel coordinates. Use this as Orion's primary interaction layer for visible workflows such as creating or editing estimates. Observe when the current control map is unknown or stale, then reuse returned refs while that screen remains mounted. Navigation returns an internal BOS href while preserving Orion's persistent session. Destructive actions are blocked here and must use confirmed canonical BOS tools.",
      parameters: wrappedToolParameters({
        action: { type: "string", enum: ["observe", "navigate", "set", "click"], description: "Observe the current screen, navigate to a BOS route, set a visible form control, or click a visible button/link." },
        href: { type: "string", description: "Internal BOS route such as /estimates/new. Used only with navigate." },
        ref: { type: "string", description: "Exact semantic control ref returned by observe. Used with set or click." },
        value: { type: ["string", "number"], description: "Actual value to enter/select. Used only with set." },
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

function buildRealtimeMultipartBody(sdp: string, session: Record<string, unknown>) {
  const boundary = `----BangoOSRealtime${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="sdp"',
    "Content-Type: application/sdp",
    "",
    sdp,
    `--${boundary}`,
    'Content-Disposition: form-data; name="session"',
    "Content-Type: application/json",
    "",
    JSON.stringify(session),
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
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
    const session = {
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
        "Never interpret the name of a field as the value for that field. If the user says 'customer name', that identifies the field they want to discuss; ask for the actual customer's name instead of entering those words.",
        "Orion Operator architecture: use the visible BOS interface as the source of truth for interactive workflows. Do not invent form schemas from memory when the UI can be observed.",
        `For visible workflows, use ${UI_OPERATOR_TOOL_NAME} with action=observe after navigation, when you have not yet observed the current mounted screen, after adding/removing dynamic controls, or when a ref becomes stale. Reuse the exact semantic refs from the latest valid observation for ordinary follow-up field updates on the same mounted screen. Do NOT re-observe before every simple set action.`,
        "Do not use pixel coordinates, DOM guesses, CSS selectors, or imagined controls. Only act on controls returned by the operator observation.",
        `MANDATORY visible-create rule: when the user asks to create, start, build, make, or fill a new estimate, your first operational action MUST be ${UI_OPERATOR_TOOL_NAME} with action=navigate and href=/estimates/new. Do this before asking the first estimate follow-up question.`,
        "Do not call a canonical estimate-create/database mutation tool merely because the user says create a new estimate. A visible create/edit request begins in the visible form through Orion Operator; canonical mutation tools are reserved for actions that cannot or should not be completed through the visible workflow.",
        "After navigation to /estimates/new succeeds, immediately use orion_ui_operator with action=observe before trying to fill any control. If the user already supplied customer, scope, title, pricing, or line-item details in the same sentence, carry those details forward and apply them after observation instead of asking for them again.",
        "For a new estimate: navigate to /estimates/new, observe the visible form once, then have a normal conversation while filling the actual controls as information becomes known. Continue using the known refs until the form structure changes. The user should be able to watch you fill the estimate in real time.",
        "When creating an estimate, ask for information naturally rather than reciting a form. Start with the customer and what the work is for, then gather useful scope/line-item/pricing details. Accept several details in one answer and fill all clearly understood values.",
        "When the user gives a customer or project name, select the matching visible option. If the option is not present, explain that instead of fabricating a match.",
        "For line items, observe when the row map is unknown. If a blank row exists, fill it. Otherwise click the visible Add Line Item control, observe again because the dynamic row structure changed, and then fill the new row. Translate normal construction language into the visible quantity, unit, unit cost, markup, description, category, and notes controls when those values are actually stated or safely implied.",
        "Corrections override earlier information. If the user says 'actually make that 950 square feet', locate the relevant known visible control and change it immediately without another observation unless the ref is stale.",
        "After any successful user-visible set, click, save, or navigation action, continue the conversation with spoken audio. Briefly acknowledge what changed and ask the next necessary question when the task is incomplete. Do not silently update BOS and wait for the user to notice.",
        "Do not save merely because the form looks complete. When the user asks to save, observe the form if needed, mention any important visible validation problem, then click the appropriate visible save control. Never claim success before the UI/tool result confirms the action was activated.",
        "Use canonical BOS tools instead of direct UI clicks for destructive, irreversible, permission-sensitive, or confirmation-required actions. The UI operator intentionally blocks destructive controls.",
        "Conversation-first routing rule: greetings, capability checks, pleasantries, and questions about Orion itself must be answered directly and MUST NOT call a BOS tool. A capability check such as 'can you hear me?' is conversation, never a navigation or customer action.",
        "Only call a BOS tool when the user clearly asks to read, navigate, create, update, execute, or otherwise operate on BOS data or a BOS screen.",
        "Navigation tools require explicit navigation intent. Never navigate merely because a module name is loosely related to the user's words.",
        "If you are uncertain whether the user wants a BOS action or conversation, ask one short clarification instead of executing a tool.",
        `Use ${CONTEXT_TOOL_NAME} whenever current-page context could supply a missing record after clear BOS intent is established.`,
        `Use ${RESOLVE_ENTITY_TOOL_NAME} to translate spoken customer/project/estimate/invoice names or numbers into canonical BOS ids when an id-based BOS tool requires one. Never invent an id.`,
        "When entity resolution returns more than one candidate, ask a short clarification so the user chooses the intended record. Never guess among ambiguous candidates.",
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
    };
    const multipart = buildRealtimeMultipartBody(body.sdp, session);

    const openAIResponse = await fetch(OPENAI_REALTIME_CALLS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": multipart.contentType,
      },
      body: multipart.body,
      cache: "no-store",
    });
    const answerSdp = await openAIResponse.text();
    if (!openAIResponse.ok || !answerSdp.trim()) {
      return NextResponse.json({ ok: false, error: answerSdp.trim() || "OpenAI Realtime session creation failed.", statusCategory: "realtime_connection_failed" }, { status: openAIResponse.status || 502 });
    }

    return NextResponse.json({ ok: true, sdp: answerSdp, model: modelConfig.realtimeModel, voice, toolCount: tools.length });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to create Orion Realtime session.", statusCategory: "realtime_error" }, { status: 500 });
  }
}
