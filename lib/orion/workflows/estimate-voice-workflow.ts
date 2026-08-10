import type { SupabaseClient } from "@supabase/supabase-js";
import { createOrionCommandRegistry } from "@/lib/orion/commands";
import type { OrionIntentInput, OrionIntentResult } from "@/lib/orion/intent-engine";
import type { WorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";

const SESSION_TIMEOUT_MS = 10 * 60_000;

type EstimateDraft = {
  customerId?: string;
  customerLabel?: string;
  projectId?: string;
  projectLabel?: string;
  title?: string;
  description?: string;
};

type EstimateSession = {
  draft: EstimateDraft;
  expiresAtMs: number;
};

const sessions = new Map<string, EstimateSession>();

function key(workspace: WorkspaceContext) {
  return `${workspace.companyId}:${workspace.userId}`;
}

export function beginEstimateVoiceWorkflowSession(workspace: WorkspaceContext) {
  sessions.set(key(workspace), { draft: {}, expiresAtMs: Date.now() + SESSION_TIMEOUT_MS });
}

export function hasActiveEstimateVoiceWorkflowSession(workspace: WorkspaceContext) {
  const sessionKey = key(workspace);
  const existing = sessions.get(sessionKey);
  if (existing && existing.expiresAtMs <= Date.now()) {
    sessions.delete(sessionKey);
    return false;
  }
  return Boolean(existing);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").replace(/\s+/g, " ").trim();
}

function passiveIntent(message: string): OrionIntentResult {
  return {
    resolvedIntent: "create",
    resolvedEntity: null,
    confidence: 1,
    candidates: [],
    suggestedCommand: null,
    commandPreview: null,
    requiresClarification: false,
    message,
  };
}

function isEstimateStart(input: string) {
  const text = normalize(input);
  return /\b(create|make|start|begin|build|new)\b.*\b(estimate|quote)\b/.test(text)
    || /\b(estimate|quote)\b.*\b(create|make|start|begin|build|new)\b/.test(text)
    || /\bput together\b.*\b(estimate|quote)\b/.test(text);
}

function isCancel(input: string) {
  return /^(cancel|stop|never mind|nevermind|cancel estimate)$/.test(normalize(input));
}

function isSave(input: string) {
  return /^(save|save it|save estimate|create it|finish|finish it|done|that s all|thats all)$/.test(normalize(input));
}

function extractExplicit(input: string, labels: string[]) {
  const raw = input.trim();
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`^${escaped}\\s*(?:is|:|=)?\\s+(.+)$`, "i"),
      new RegExp(`^(?:set|add|use)\\s+${escaped}\\s+(?:to\\s+)?(.+)$`, "i"),
    ];
    for (const pattern of patterns) {
      const match = raw.match(pattern);
      if (match?.[1]?.trim()) return match[1].trim();
    }
  }
  return null;
}

async function resolveCustomer(
  supabase: SupabaseClient<Database>,
  companyId: string,
  phrase: string,
) {
  const value = phrase.trim();
  const { data, error } = await supabase
    .from("customers")
    .select("id, first_name, last_name, company_name")
    .eq("company_id", companyId)
    .or(`company_name.ilike.%${value}%,first_name.ilike.%${value}%,last_name.ilike.%${value}%`)
    .limit(5);

  if (error || !data?.length) return { match: null, ambiguous: false } as const;
  if (data.length > 1) return { match: null, ambiguous: true } as const;
  const row = data[0];
  const label = row.company_name?.trim() || [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Customer";
  return { match: { id: row.id, label }, ambiguous: false } as const;
}

async function resolveProject(
  supabase: SupabaseClient<Database>,
  companyId: string,
  phrase: string,
) {
  const value = phrase.trim();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name")
    .eq("company_id", companyId)
    .ilike("name", `%${value}%`)
    .limit(5);

  if (error || !data?.length) return { match: null, ambiguous: false } as const;
  if (data.length > 1) return { match: null, ambiguous: true } as const;
  return { match: { id: data[0].id, label: data[0].name }, ambiguous: false } as const;
}

function draftSummary(draft: EstimateDraft) {
  const parts = [
    draft.customerLabel ? `customer ${draft.customerLabel}` : null,
    draft.projectLabel ? `project ${draft.projectLabel}` : null,
    draft.title ? `estimate name ${draft.title}` : null,
    draft.description ? "scope of work added" : null,
  ].filter(Boolean);
  return parts.length ? `I have ${parts.join(", ")}.` : "I have the estimate started.";
}

function nextPrompt(draft: EstimateDraft) {
  if (!draft.customerId) return " Who is the customer?";
  if (!draft.title) return " What would you like to call the estimate?";
  return " You can add the project, scope of work, or pricing, or say save estimate.";
}

function createEstimateIntent(draft: EstimateDraft): OrionIntentResult {
  const command = createOrionCommandRegistry().getById("estimate.create");
  if (!command) {
    return passiveIntent("Estimate creation is not available right now.");
  }

  const today = new Date().toISOString().slice(0, 10);
  const values = {
    title: draft.title || "New Estimate",
    estimateNumber: "",
    customerId: draft.customerId || "",
    projectId: draft.projectId || "",
    issueDate: today,
    expirationDate: "",
    preparedBy: "",
    status: "draft",
    description: draft.description || "",
    discountType: "none",
    discountValue: "0",
    taxRatePercent: "0",
    additionalFee: "0",
    internalNotes: "",
    customerNotes: "",
    scopeInclusions: draft.description || "",
    scopeExclusions: "",
    terms: "",
    paymentTerms: "",
  };

  return {
    resolvedIntent: "create",
    resolvedEntity: null,
    confidence: 1,
    candidates: [],
    suggestedCommand: {
      commandId: command.id,
      params: { values, lineItems: [] },
      entityType: "estimate",
      entityId: null,
    },
    commandPreview: {
      commandId: command.id,
      target: draft.title || "new estimate",
      permission: command.requiredPermissions,
      confirmationLevel: command.confirmationLevel,
      expectedOutcome: "Create a draft estimate using the live BOS estimate service.",
      eventsThatWillPublish: command.eventContract?.expectedEvents || [],
    },
    requiresClarification: false,
    message: `Creating the ${draft.title || "new"} estimate${draft.customerLabel ? ` for ${draft.customerLabel}` : ""}.`,
  };
}

export async function resolveEstimateVoiceWorkflowTurn(args: {
  supabase: SupabaseClient<Database>;
  workspace: WorkspaceContext;
  input: OrionIntentInput;
}): Promise<{ handled: boolean; intent: OrionIntentResult | null; statusCategory: string | null }> {
  const sessionKey = key(args.workspace);
  const existing = sessions.get(sessionKey);
  if (existing && existing.expiresAtMs <= Date.now()) sessions.delete(sessionKey);

  if (isEstimateStart(args.input.input)) {
    beginEstimateVoiceWorkflowSession(args.workspace);
    return {
      handled: true,
      intent: passiveIntent("Okay, starting a new estimate. What information would you like me to add first? You can tell me the customer, project, estimate name, scope of work, or pricing."),
      statusCategory: "workflow_collecting",
    };
  }

  const session = sessions.get(sessionKey);
  if (!session) return { handled: false, intent: null, statusCategory: null };

  if (isCancel(args.input.input)) {
    sessions.delete(sessionKey);
    return { handled: true, intent: passiveIntent("Okay, I canceled the estimate setup."), statusCategory: "workflow_complete" };
  }

  if (isSave(args.input.input)) {
    if (!session.draft.customerId) {
      return { handled: true, intent: passiveIntent("Before I save it, who is the customer?"), statusCategory: "workflow_collecting" };
    }
    if (!session.draft.title) {
      return { handled: true, intent: passiveIntent("Before I save it, what would you like to call the estimate?"), statusCategory: "workflow_collecting" };
    }
    sessions.delete(sessionKey);
    return { handled: true, intent: createEstimateIntent(session.draft), statusCategory: "workflow_ready" };
  }

  const customerPhrase = extractExplicit(args.input.input, ["customer", "customer name", "for customer"]);
  if (customerPhrase) {
    const customer = await resolveCustomer(args.supabase, args.workspace.companyId, customerPhrase);
    if (customer.ambiguous) {
      return { handled: true, intent: passiveIntent("I found more than one matching customer. Please say the customer's full name or company name."), statusCategory: "workflow_collecting" };
    }
    if (!customer.match) {
      return { handled: true, intent: passiveIntent(`I couldn't find a customer matching ${customerPhrase}. Who should I use?`), statusCategory: "workflow_collecting" };
    }
    session.draft.customerId = customer.match.id;
    session.draft.customerLabel = customer.match.label;
    session.expiresAtMs = Date.now() + SESSION_TIMEOUT_MS;
    return { handled: true, intent: passiveIntent(`${customer.match.label}, got it.${nextPrompt(session.draft)}`), statusCategory: "workflow_collecting" };
  }

  const projectPhrase = extractExplicit(args.input.input, ["project", "project name", "job"]);
  if (projectPhrase) {
    const project = await resolveProject(args.supabase, args.workspace.companyId, projectPhrase);
    if (project.ambiguous) {
      return { handled: true, intent: passiveIntent("I found more than one matching project. Please say the full project name."), statusCategory: "workflow_collecting" };
    }
    if (!project.match) {
      return { handled: true, intent: passiveIntent(`I couldn't find a project matching ${projectPhrase}. You can try another name or skip the project.`), statusCategory: "workflow_collecting" };
    }
    session.draft.projectId = project.match.id;
    session.draft.projectLabel = project.match.label;
    session.expiresAtMs = Date.now() + SESSION_TIMEOUT_MS;
    return { handled: true, intent: passiveIntent(`${project.match.label}, got it.${nextPrompt(session.draft)}`), statusCategory: "workflow_collecting" };
  }

  const title = extractExplicit(args.input.input, ["estimate name", "estimate title", "title", "name"]);
  if (title) {
    session.draft.title = title;
    session.expiresAtMs = Date.now() + SESSION_TIMEOUT_MS;
    return { handled: true, intent: passiveIntent(`Okay, I'll call it ${title}.${nextPrompt(session.draft)}`), statusCategory: "workflow_collecting" };
  }

  const scope = extractExplicit(args.input.input, ["scope of work", "scope", "description"]);
  if (scope) {
    session.draft.description = scope;
    session.expiresAtMs = Date.now() + SESSION_TIMEOUT_MS;
    return { handled: true, intent: passiveIntent(`I added that scope of work. ${draftSummary(session.draft)}${nextPrompt(session.draft)}`), statusCategory: "workflow_collecting" };
  }

  // Natural short answers: first resolve a missing customer, then use the next short answer as the title.
  if (!session.draft.customerId) {
    const customer = await resolveCustomer(args.supabase, args.workspace.companyId, args.input.input);
    if (customer.match) {
      session.draft.customerId = customer.match.id;
      session.draft.customerLabel = customer.match.label;
      session.expiresAtMs = Date.now() + SESSION_TIMEOUT_MS;
      return { handled: true, intent: passiveIntent(`${customer.match.label}, got it. What would you like to call the estimate?`), statusCategory: "workflow_collecting" };
    }
  }

  if (!session.draft.title && args.input.input.trim().length <= 120) {
    session.draft.title = args.input.input.trim();
    session.expiresAtMs = Date.now() + SESSION_TIMEOUT_MS;
    return { handled: true, intent: passiveIntent(`Okay, I'll call it ${session.draft.title}. You can add scope or pricing, or say save estimate.`), statusCategory: "workflow_collecting" };
  }

  return {
    handled: true,
    intent: passiveIntent(`${draftSummary(session.draft)} Tell me the customer, project, estimate name, or scope, or say save estimate.`),
    statusCategory: "workflow_collecting",
  };
}
