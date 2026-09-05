import { NextRequest, NextResponse } from "next/server";
import { buildOrionSystemPolicy, buildUniversalBosToolCatalog, getOrionModelConfig } from "@/lib/orion/intelligence";
import { isOrionVoiceAutomationEnabled, ORION_VOICE_FREEZE_MESSAGE } from "@/lib/orion/runtime-config";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { ORION_OPERATOR_MAIN_ROUTES } from "@/lib/orion/operator/routes";
import { DEFAULT_ORION_VOICE_STYLE, isOrionVoiceStyleProfile, voiceStyleInstruction } from "@/lib/orion/voice/realtime-voice-profile";
import { DEFAULT_ORION_VOICE_ISOLATION_MODE, isOrionVoiceIsolationMode, voiceIsolationInstruction } from "@/lib/orion/voice/voice-isolation";

const OPENAI_REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";
const DEFAULT_REALTIME_VOICE = "marin";
const CONFIRM_TOOL_NAME = "bos_confirm_pending_action";
const RESEARCH_TOOL_NAME = "orion_web_research";
const CONTEXT_TOOL_NAME = "orion_current_context";
const RESOLVE_ENTITY_TOOL_NAME = "orion_resolve_entity";
const UI_OPERATOR_TOOL_NAME = "orion_ui_operator";
const PERSONAL_ASSISTANT_TOOL_NAME = "orion_personal_assistant";
const VIEWPORT_CONTROL_TOOL_NAME = "orion_viewport_control";
const AUTONOMY_SAFE_READ_TOOL_NAME = "orion_autonomy_safe_read";

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
      description: "Observe and operate the actual visible BangoOS interface using semantic control references rather than pixel coordinates. Use this when the user specifically wants to see, fill, edit, or review the visible form. First observe the screen, then use returned refs. Prefer batch_set whenever two or more already-observed form values can be updated together. For direct create/save requests, prefer the canonical BOS fast-path tools instead of opening a form. Navigation returns an internal BOS href while preserving Orion's persistent session. Destructive actions are blocked here and must use confirmed canonical BOS tools.",
      parameters: wrappedToolParameters({
        action: { type: "string", enum: ["observe", "navigate", "set", "batch_set", "click", "scroll"], description: "Observe, navigate, set one field, batch-set multiple fields, click, or semantically scroll the active BOS content region." },
        href: { type: "string", description: `Verified BOS route. Main routes: ${ORION_OPERATOR_MAIN_ROUTES.join(", ")}. New-estimate route: /estimates/new. Used only with navigate.` },
        ref: { type: "string", description: "Exact semantic control ref returned by observe. Used with set or click." },
        value: { type: ["string", "number"], description: "Actual value to enter/select. Used only with set." },
        changes: {
          type: "array",
          minItems: 1,
          maxItems: 40,
          description: "Field updates to apply in one atomic preflighted browser operation. Use with batch_set. Every ref must come from the latest observation. The batch can update mounted observed form controls even when some are below the current viewport, avoiding unnecessary scroll/re-observe round trips.",
          items: {
            type: "object",
            properties: {
              ref: { type: "string", description: "Exact observed semantic control ref." },
              value: { type: ["string", "number"], description: "Value to enter or select." },
            },
            required: ["ref", "value"],
            additionalProperties: false,
          },
        },
        direction: { type: "string", enum: ["up", "down", "top", "bottom", "control"], description: "Scroll one active-content viewport, jump to a boundary, or bring ref into view. Used only with scroll." },
      }, ["action"]),
    },
    {
      type: "function" as const,
      name: PERSONAL_ASSISTANT_TOOL_NAME,
      description: "Create, list, or cancel persistent Orion reminders and calendar-event alerts on this B.O.S. device. Use action=now first whenever the user's requested time is relative or ambiguous so you resolve the device-local date, time, and timezone before setting the reminder. For event alerts, dueAt is the actual alert time and eventStartsAt is the calendar event start time when known.",
      parameters: wrappedToolParameters({
        action: { type: "string", enum: ["now", "set_reminder", "set_event_alert", "list", "cancel"] },
        title: { type: "string", description: "Short reminder title." },
        message: { type: "string", description: "What Orion should alert the user about." },
        dueAt: { type: "string", description: "Future date/time for the alert. Use an ISO 8601 value with the device timezone offset whenever possible." },
        eventTitle: { type: "string", description: "Calendar event or appointment title for event alerts." },
        eventStartsAt: { type: "string", description: "Calendar event start date/time when known." },
        linkedHref: { type: "string", description: "Optional internal B.O.S. path associated with the reminder." },
        reminderId: { type: "string", description: "Exact id returned by list/set. Required only for cancel." },
      }, ["action"]),
    },
    {
      type: "function" as const,
      name: VIEWPORT_CONTROL_TOOL_NAME,
      description: "Control B.O.S. page zoom directly by voice. Use for zoom in, zoom out, reset zoom, set a specific percentage, or report the current zoom. This changes B.O.S. application zoom, not camera zoom or blueprint-specific model scale.",
      parameters: wrappedToolParameters({
        action: { type: "string", enum: ["zoom_in", "zoom_out", "reset", "set", "get"] },
        percent: { type: ["number", "string"], description: "Requested B.O.S. zoom percentage from 75 to 150. Used only with action=set." },
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
      description: "Resolve a spoken BOS customer, project, estimate, or invoice name/number to a company-scoped record id. Use this when an id-based action does not provide a human-name alias field. Fast create tools can resolve their documented customerName/projectName/estimateName aliases inside the same command call. If multiple candidates are returned, ask the user to choose rather than guessing.",
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
      name: AUTONOMY_SAFE_READ_TOOL_NAME,
      description: "Plan and execute only the read-only prefix of an ordered multi-step BOS request. Every step must name an existing canonical BOS tool and its params. Later read steps may consume verified output from an earlier step by using an exact whole-value reference such as $step.1.entityId, $step.1.href, or $step.1.details.projectId. This tool re-plans and re-authorizes server-side, executes at most eight read-risk steps, verifies each result, and stops before every write, external effect, financial, destructive, or legal/authority action. Never use it to bypass normal canonical BOS confirmation controls.",
      parameters: wrappedToolParameters({
        steps: {
          type: "array",
          minItems: 1,
          maxItems: 8,
          description: "Ordered canonical BOS tool calls for the task. Use exact available bos_* tool names.",
          items: {
            type: "object",
            properties: {
              toolName: { type: "string", description: "Exact canonical bos_* tool name." },
              params: { type: "object", additionalProperties: true, description: "Parameters for that canonical BOS tool. A whole parameter value may reference a verified earlier read result using $step.N.entityId, $step.N.href, $step.N.createdEntityIds.0, $step.N.updatedEntityIds.0, or $step.N.details.someField. References may only point backward to completed steps and fail closed if missing." },
            },
            required: ["toolName"],
            additionalProperties: false,
          },
        },
        executionId: { type: "string", description: "Optional stable identifier for retry-safe sequence execution." },
      }, ["steps"]),
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

    const body = await req.json() as { sdp?: unknown; voice?: unknown; voiceStyle?: unknown; isolationMode?: unknown };
    if (typeof body.sdp !== "string" || !body.sdp.trim()) return NextResponse.json({ ok: false, error: "sdp is required." }, { status: 400 });

    const modelConfig = getOrionModelConfig();
    const voice = realtimeVoice(body.voice);
    const voiceStyle = isOrionVoiceStyleProfile(body.voiceStyle) ? body.voiceStyle : DEFAULT_ORION_VOICE_STYLE;
    const isolationMode = isOrionVoiceIsolationMode(body.isolationMode) ? body.isolationMode : DEFAULT_ORION_VOICE_ISOLATION_MODE;
    const tools = realtimeBosTools();
    const session = {
      type: "realtime",
      model: modelConfig.realtimeModel,
      output_modalities: ["audio"],
      instructions: [
        buildOrionSystemPolicy(),
        "You are Orion, the realtime conversational operating intelligence for BangoOS.",
        "Language policy: understand and speak English only. Always answer in natural American English unless the user explicitly asks you, in the current conversation, to translate or speak another language. Never switch languages because of noise, an accent, a customer or project name, or an uncertain transcript.",
        "Speak naturally, briefly, confidently, and conversationally. The user should be able to talk to you the way they talk to a capable human assistant.",
        voiceStyleInstruction(voiceStyle),
        voiceIsolationInstruction(isolationMode),
        "Execution-speed policy: for clear reversible BOS requests, call the correct tool immediately and narrate briefly after the tool result. Do not spend a response explaining what you are about to do when you can safely start doing it.",
        `Multi-step autonomy policy: when a user asks for an ordered task containing two or more BOS lookups/reads, or a larger task whose first steps are reads, call ${AUTONOMY_SAFE_READ_TOOL_NAME} with those canonical bos_* tool calls in order. It may execute only the verified read-only prefix and will stop before every non-read step. Never bypass a returned boundary: continue any write or protected step only through its normal canonical BOS tool so existing review and confirmation controls remain authoritative.`,
        "Read-chain policy: when a later read depends on the verified result of an earlier read in the same safe sequence, use an exact $step.N output reference instead of guessing or inventing an id. Only reference an earlier step, and use the reference as the entire parameter value so BOS can preserve the original value type.",
        `Reminder policy: use ${PERSONAL_ASSISTANT_TOOL_NAME} for spoken reminders and calendar-event alerts. If the user says a relative time such as later, in 30 minutes, tomorrow morning, or before an event, call action=now first so you anchor the request to the device-local clock. Never claim a reminder is set until the tool returns success.`,
        `Calendar-alert policy: use ${PERSONAL_ASSISTANT_TOOL_NAME} action=set_event_alert when the user asks to be alerted before or at a meeting, appointment, inspection, job, schedule item, or other calendar event. Keep eventStartsAt separate from dueAt so the alert can occur before the event.`,
        `Zoom policy: when the user says zoom in, zoom out, make this bigger/smaller, reset zoom, or set a B.O.S. zoom percentage, call ${VIEWPORT_CONTROL_TOOL_NAME} immediately. Do not use UI scrolling for zoom requests.`,
        "Direct-work fast path: when the user asks you to create or save a customer, project, estimate, or invoice now, prefer bos_customer_create, bos_project_create, bos_estimate_create, or bos_invoice_create. These execute through canonical BOS services and should not require opening the form first.",
        "Fast create tools accept documented human-name aliases such as customerName, projectName, and estimateName. Use those aliases directly instead of making a separate entity-resolution tool call when the fast tool supports the alias. BOS will resolve a unique company-scoped match inside the same request and will reject ambiguous matches rather than guessing.",
        "Visible-form boundary: use Orion UI Operator when the user explicitly says to open, show, fill out, edit on screen, review, or watch the form, or when a canonical command does not cover the requested operation. Do not force a visible form for a direct create/save request.",
        "If the user asks to create a draft estimate and already supplied a customer name, title or scope, pricing, or line items, call bos_estimate_create directly with every known value. Missing optional estimate fields are normalized safely by BOS. Ask only for genuinely required business information, not boilerplate fields BOS can default.",
        "If the user asks to create a draft invoice and already supplied the customer/project/estimate name, title, pricing, or line items, call bos_invoice_create directly with every known value. Missing optional invoice fields are normalized safely by BOS.",
        "Do not force command syntax. Interpret ordinary language, corrections, pronouns, short answers, interruptions, and follow-up statements in the context of the active conversation and task.",
        "Wake behavior: at the beginning of a new Realtime conversation, remain dormant until the user directly wakes or addresses you with Hey Orion, Okay Orion, Orion, or a clearly equivalent direct address.",
        "The wake phrase and request may be in the same utterance. Process both immediately.",
        "After awakened, remain active for the rest of that Realtime conversation. Do not require another wake phrase for follow-ups.",
        "If you ask a question, the next user utterance is normally the answer to that question, even when it is only a name, number, phrase, yes/no answer, or correction.",
        "Never interpret the name of a field as the value for that field. If the user says 'customer name', that identifies the field they want to discuss; ask for the actual customer's name instead of entering those words.",
        "Orion Operator architecture: use the visible BOS interface as the source of truth only for visible interactive workflows. Do not invent form schemas from memory when the UI needs to be observed.",
        `For visible workflows, use ${UI_OPERATOR_TOOL_NAME} with action=observe before manipulating controls. Use the exact semantic refs returned by observe. Re-observe after navigation, after adding dynamic rows, or whenever a ref is stale.`,
        "Fast form policy: when the latest observation contains two or more controls whose values are already known, use orion_ui_operator action=batch_set and send all known field updates together. Do not issue separate set calls for fields that can be safely batch-set in the same mounted form.",
        "Batch-set preflights every target before changing the form, blocks confirmation-sensitive controls, and can update already-observed mounted fields that are below the viewport. Do not scroll merely to fill an offscreen field that was returned by the latest observation; batch it instead. Scroll/re-observe only when a needed control was not observed, a dynamic row must be added, or a click target is offscreen.",
        "Do not use pixel coordinates, DOM guesses, CSS selectors, or imagined controls. Only act on controls returned by the operator observation.",
        "If a needed click target is outside the viewport, or a needed field was not present in the latest observation, use orion_ui_operator action=scroll with direction=control and its exact ref when available. For general movement use up, down, top, or bottom. After every scroll, you MUST observe again before setting or clicking because prior screen state is stale.",
        "For project edits, resolve the current or spoken project, navigate to its verified /projects/{id}/edit route, observe the mounted form, and edit only returned semantic controls. Never invent a project id or field.",
        "Project status controls are confirmation-sensitive. If the Operator reports requiresCanonicalConfirmation, use the canonical confirmed BOS status tool instead of bypassing the visible guard.",
        `Navigation safety: never invent a path from a spoken tab name. Use the exact verified BOS routes accepted by the Operator. Main routes: ${ORION_OPERATOR_MAIN_ROUTES.join(", ")}. If navigation is rejected, use the validMainRoutes returned by the tool instead of retrying a guessed path.`,
        "Visible estimate workflow: when the user specifically asks to open/show/fill/review the estimate form, navigate to /estimates/new, observe once, then batch-fill every compatible known value. If the user only asks you to create/save the estimate, use the canonical estimate fast path instead.",
        "When creating an estimate conversationally, accept several details in one answer. For direct creation, place all known values into one bos_estimate_create call. For a visible form, place all compatible observed values into one batch_set call.",
        "For visible estimate line items, first observe. If a blank row exists, batch-fill every known field in that row. Otherwise click the visible Add Line Item control, observe once, and then batch-fill the newly mounted row. For direct estimate creation, include all known line items in the single bos_estimate_create call instead.",
        "Corrections override earlier information. Apply corrected values immediately; use the direct canonical update/create command when appropriate or batch_set when the user is working visibly in a mounted form.",
        "For visible forms, do not save merely because the form looks complete. When the user asks to save, observe the form, mention any important visible validation problem, then click the appropriate visible save control. Never claim success before the UI/tool result confirms the action was activated.",
        "Use canonical BOS tools instead of direct UI clicks for destructive, irreversible, permission-sensitive, or confirmation-required actions. The UI operator intentionally blocks destructive controls.",
        "Conversation-first routing rule: greetings, capability checks, pleasantries, and questions about Orion itself must be answered directly and MUST NOT call a BOS tool. A capability check such as 'can you hear me?' is conversation, never a navigation or customer action.",
        "Only call a BOS tool when the user clearly asks to read, navigate, create, update, execute, or otherwise operate on BOS data or a BOS screen.",
        "Navigation tools require explicit navigation intent. Never navigate merely because a module name is loosely related to the user's words.",
        "If you are uncertain whether the user wants a BOS action or conversation, ask one short clarification instead of executing a tool.",
        `Use ${CONTEXT_TOOL_NAME} whenever current-page context could supply a missing record after clear BOS intent is established.`,
        `Use ${RESOLVE_ENTITY_TOOL_NAME} to translate spoken customer/project/estimate/invoice names or numbers into canonical BOS ids only when the target canonical tool does not already support a human-name alias. Never invent an id.`,
        "When entity resolution returns more than one candidate, ask a short clarification so the user chooses the intended record. Never guess among ambiguous candidates.",
        "When two or more independent read/resolution tools are needed and neither depends on the other's output, issue them in the same response so they can execute concurrently instead of serially.",
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
          noise_reduction: { type: isolationMode === "focused" ? "near_field" : "far_field" },
          transcription: {
            model: "gpt-4o-mini-transcribe",
            language: "en",
            prompt: "BangoOS construction terminology, customer names, project names, estimates, invoices, crews, change orders, line items, quantities, square feet, linear feet, markup, tax, scope, reminders, calendar alerts, zoom in, zoom out, confirm, cancel.",
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
