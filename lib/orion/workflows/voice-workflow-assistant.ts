import type { SupabaseClient } from "@supabase/supabase-js";
import { createOrionCommandRegistry } from "@/lib/orion/commands";
import type { OrionCommandDefinition } from "@/lib/orion/commands";
import { createOrionDecisionEngine } from "@/lib/orion/decision";
import type { OrionIntentInput, OrionIntentKind, OrionIntentResult } from "@/lib/orion/intent-engine";
import { createOrionTimelineService } from "@/lib/orion/timeline";
import { createWorkforceRepository } from "@/lib/workforce/workforce-repository";
import type { WorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";

type WorkflowId = "customer.create" | "project.create" | "task.create" | "project.assign_crew" | "crew.create";

type WorkflowField = {
  key: string;
  label: string;
  prompt: string;
  required: boolean;
  aliases: string[];
  validate?: (value: string) => string | null;
  normalize?: (value: string) => string;
};

type WorkflowSession = {
  workflowId: WorkflowId;
  draft: Record<string, string>;
  awaitingConfirmation: boolean;
  startedAtMs: number;
  expiresAtMs: number;
};

type WorkflowHandlingResult = {
  handled: boolean;
  intent: OrionIntentResult | null;
  statusCategory: string | null;
};

type BuildParamsResult = {
  params: Record<string, unknown> | null;
  fieldErrorKey?: string;
  fieldErrorMessage?: string;
};

type WorkflowDefinition = {
  id: WorkflowId;
  noun: string;
  commandId: WorkflowId;
  fields: WorkflowField[];
  buildParams: (args: {
    supabase: SupabaseClient<Database>;
    companyId: string;
    draft: Record<string, string>;
  }) => Promise<BuildParamsResult>;
};

const SESSION_TIMEOUT_MS = 8 * 60_000;
const sessions = new Map<string, WorkflowSession>();

function nowMs() {
  return Date.now();
}

function normalizeInput(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function trimToNull(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function emptyIntent(message: string): OrionIntentResult {
  return {
    resolvedIntent: null,
    resolvedEntity: null,
    confidence: 1,
    candidates: [],
    suggestedCommand: null,
    commandPreview: null,
    requiresClarification: false,
    message,
  };
}

function resolveIntentKind(commandId: string): OrionIntentKind {
  if (commandId.endsWith(".create")) {
    return "create";
  }

  if (commandId.includes("assign")) {
    return "assign";
  }

  if (commandId.endsWith(".open")) {
    return "open";
  }

  if (commandId.includes("schedule.read")) {
    return "view";
  }

  return "view";
}

function expectedOutcomeForCommand(command: OrionCommandDefinition) {
  if (command.coverage.status === "unsupported") {
    return command.coverage.reason || "This action is not currently implemented.";
  }

  if (command.id.endsWith(".open") || command.id.endsWith(".view")) {
    return "Open target workspace route.";
  }

  return "Execute Orion command and publish workflow events when applicable.";
}

function commandIntent(params: {
  command: OrionCommandDefinition;
  commandParams: Record<string, unknown>;
  message: string;
}): OrionIntentResult {
  const command = params.command;

  return {
    resolvedIntent: resolveIntentKind(command.id),
    resolvedEntity: null,
    confidence: 0.99,
    candidates: [],
    suggestedCommand: {
      commandId: command.id,
      params: params.commandParams,
      entityType: (command.entityType || null) as OrionIntentResult["suggestedCommand"] extends { entityType: infer T } ? T : never,
      entityId: null,
    },
    commandPreview: {
      commandId: command.id,
      target: `${command.entityType} workflow`,
      permission: command.requiredPermissions,
      confirmationLevel: command.confirmationLevel,
      expectedOutcome: expectedOutcomeForCommand(command),
      eventsThatWillPublish: command.eventContract?.expectedEvents || [],
    },
    requiresClarification: false,
    message: params.message,
  };
}

function sessionKey(companyId: string, userId: string) {
  return `${companyId}:${userId}`;
}

function isCancelPhrase(input: string) {
  return /^(cancel|stop|never mind|nevermind|abort)$/.test(input);
}

function isConfirmPhrase(input: string) {
  return /^(yes|confirm|save|submit|do it|go ahead)$/.test(input);
}

function isRejectPhrase(input: string) {
  return /^(no|dont save|don't save|cancel it|not now)$/.test(input);
}

function summaryValue(value: string | undefined) {
  if (!value) {
    return "(not provided)";
  }

  return value;
}

function cleanExpiredSessions() {
  const now = nowMs();
  for (const [key, value] of sessions.entries()) {
    if (value.expiresAtMs <= now) {
      sessions.delete(key);
    }
  }
}

function findNextField(definition: WorkflowDefinition, draft: Record<string, string>) {
  return definition.fields.find((field) => field.required && !trimToNull(draft[field.key]));
}

function formatWorkflowSummary(definition: WorkflowDefinition, draft: Record<string, string>) {
  const lines = definition.fields
    .filter((field) => field.required || trimToNull(draft[field.key]))
    .map((field) => `${field.label}: ${summaryValue(trimToNull(draft[field.key]) || undefined)}`);

  return `I have ${definition.noun} details. ${lines.join(". ")}. Would you like me to save it?`;
}

function parseExplicitFieldUpdate(fields: WorkflowField[], rawInput: string) {
  const normalized = normalizeInput(rawInput);

  for (const field of fields) {
    for (const alias of field.aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const patterns = [
        new RegExp(`^${escaped}\\s*[:=]\\s*(.+)$`),
        new RegExp(`^${escaped}\\s+is\\s+(.+)$`),
        new RegExp(`^(set|change|update)\\s+${escaped}\\s+to\\s+(.+)$`),
      ];

      for (const pattern of patterns) {
        const match = normalized.match(pattern);
        if (!match) {
          continue;
        }

        const value = trimToNull(match[match.length - 1]);
        if (!value) {
          return null;
        }

        return { field, value };
      }
    }
  }

  return null;
}

function validateAndNormalizeField(field: WorkflowField, rawValue: string) {
  const normalized = field.normalize ? field.normalize(rawValue) : rawValue.trim();
  const error = field.validate?.(normalized) || null;

  if (error) {
    return { ok: false as const, value: normalized, error };
  }

  return { ok: true as const, value: normalized, error: null };
}

async function resolveCustomerIdByName(supabase: SupabaseClient<Database>, companyId: string, input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return { id: null, error: null } as const;
  }

  const { data, error } = await supabase
    .from("customers")
    .select("id, first_name, last_name, company_name")
    .eq("company_id", companyId)
    .or(`company_name.ilike.%${trimmed}%,first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%`)
    .limit(3);

  if (error) {
    return { id: null, error: error.message || "Unable to resolve customer." } as const;
  }

  if (!data || data.length === 0) {
    return { id: null, error: `I could not find a customer matching ${trimmed}.` } as const;
  }

  if (data.length > 1) {
    return { id: null, error: "I found multiple customers with that name. Please give a more specific customer name." } as const;
  }

  return { id: data[0].id, error: null } as const;
}

async function resolveProjectIdByName(supabase: SupabaseClient<Database>, companyId: string, input: string) {
  const trimmed = input.trim();

  const { data, error } = await supabase
    .from("projects")
    .select("id, name")
    .eq("company_id", companyId)
    .ilike("name", `%${trimmed}%`)
    .limit(3);

  if (error) {
    return { id: null, error: error.message || "Unable to resolve project." } as const;
  }

  if (!data || data.length === 0) {
    return { id: null, error: `I could not find a project named ${trimmed}.` } as const;
  }

  if (data.length > 1) {
    return { id: null, error: "I found multiple projects with that name. Please give a more specific project name." } as const;
  }

  return { id: data[0].id, error: null } as const;
}

async function resolveCrewIdByName(supabase: SupabaseClient<Database>, companyId: string, input: string) {
  const trimmed = input.trim();

  const repository = createWorkforceRepository(supabase);
  const crews = await repository.listCrews(companyId);
  const matches = crews.filter((crew) => crew.name.toLowerCase().includes(trimmed.toLowerCase()) || crew.crew_code.toLowerCase().includes(trimmed.toLowerCase()));

  if (matches.length === 0) {
    return { id: null, error: `I could not find a crew named ${trimmed}.` } as const;
  }

  if (matches.length > 1) {
    return { id: null, error: "I found multiple crews with that name. Please be more specific." } as const;
  }

  return { id: matches[0].id, error: null } as const;
}

const workflows: WorkflowDefinition[] = [
  {
    id: "customer.create",
    noun: "customer",
    commandId: "customer.create",
    fields: [
      {
        key: "firstName",
        label: "First Name",
        prompt: "What is the customer first name?",
        required: true,
        aliases: ["first name", "customer first name", "contact first name"],
      },
      {
        key: "lastName",
        label: "Last Name",
        prompt: "What is the customer last name?",
        required: true,
        aliases: ["last name", "customer last name", "contact last name"],
      },
      {
        key: "companyName",
        label: "Company",
        prompt: "What is the company name? You can say skip.",
        required: false,
        aliases: ["company", "company name", "business name"],
      },
      {
        key: "phone",
        label: "Phone",
        prompt: "What is the phone number? You can say skip.",
        required: false,
        aliases: ["phone", "phone number"],
        validate: (value) => {
          if (!value || value === "skip") {
            return null;
          }

          const digits = value.replace(/\D/g, "");
          return digits.length >= 7 ? null : "Please provide a valid phone number.";
        },
      },
      {
        key: "email",
        label: "Email",
        prompt: "What is the email address? You can say skip.",
        required: false,
        aliases: ["email", "email address"],
        validate: (value) => {
          if (!value || value === "skip") {
            return null;
          }

          return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) ? null : "Please provide a valid email address.";
        },
      },
    ],
    async buildParams({ draft }) {
      return {
        params: {
          firstName: draft.firstName,
          lastName: draft.lastName,
          companyName: draft.companyName === "skip" ? null : trimToNull(draft.companyName),
          phone: draft.phone === "skip" ? null : trimToNull(draft.phone),
          email: draft.email === "skip" ? null : trimToNull(draft.email),
        },
      };
    },
  },
  {
    id: "project.create",
    noun: "project",
    commandId: "project.create",
    fields: [
      {
        key: "name",
        label: "Project Name",
        prompt: "What is the project name?",
        required: true,
        aliases: ["project", "project name", "name"],
      },
      {
        key: "customer",
        label: "Customer",
        prompt: "Who is the customer? You can say skip.",
        required: false,
        aliases: ["customer", "customer name"],
      },
      {
        key: "addressLine1",
        label: "Address",
        prompt: "What is the project address? You can say skip.",
        required: false,
        aliases: ["address", "project address", "site address"],
      },
      {
        key: "estimatedStartDate",
        label: "Start Date",
        prompt: "What is the estimated start date? Use YYYY-MM-DD or say skip.",
        required: false,
        aliases: ["start date", "estimated start date"],
        validate: (value) => {
          if (!value || value === "skip") {
            return null;
          }

          return /^\d{4}-\d{2}-\d{2}$/.test(value) ? null : "Please provide the date as YYYY-MM-DD.";
        },
      },
    ],
    async buildParams({ supabase, companyId, draft }) {
      const customerName = trimToNull(draft.customer);
      let customerId: string | null = null;

      if (customerName && customerName !== "skip") {
        const customer = await resolveCustomerIdByName(supabase, companyId, customerName);
        if (customer.error) {
          return {
            params: null,
            fieldErrorKey: "customer",
            fieldErrorMessage: customer.error,
          };
        }

        customerId = customer.id;
      }

      return {
        params: {
          name: draft.name,
          customerId,
          addressLine1: draft.addressLine1 === "skip" ? null : trimToNull(draft.addressLine1),
          estimatedStartDate: draft.estimatedStartDate === "skip" ? null : trimToNull(draft.estimatedStartDate),
        },
      };
    },
  },
  {
    id: "task.create",
    noun: "task",
    commandId: "task.create",
    fields: [
      {
        key: "project",
        label: "Project",
        prompt: "Which project is this task for?",
        required: true,
        aliases: ["project", "project name"],
      },
      {
        key: "title",
        label: "Task Title",
        prompt: "What is the task title?",
        required: true,
        aliases: ["task title", "title", "task"],
      },
      {
        key: "taskNumber",
        label: "Task Number",
        prompt: "What is the task number?",
        required: true,
        aliases: ["task number", "number"],
        validate: (value) => (/^\d+$/.test(value) ? null : "Task number must be a whole number."),
      },
    ],
    async buildParams({ supabase, companyId, draft }) {
      const project = await resolveProjectIdByName(supabase, companyId, draft.project);
      if (project.error || !project.id) {
        return {
          params: null,
          fieldErrorKey: "project",
          fieldErrorMessage: project.error || "Project is required.",
        };
      }

      return {
        params: {
          projectId: project.id,
          title: draft.title,
          taskNumber: Number.parseInt(draft.taskNumber, 10),
        },
      };
    },
  },
  {
    id: "project.assign_crew",
    noun: "dispatch assignment",
    commandId: "project.assign_crew",
    fields: [
      {
        key: "project",
        label: "Project",
        prompt: "Which project should I assign the crew to?",
        required: true,
        aliases: ["project", "project name"],
      },
      {
        key: "crew",
        label: "Crew",
        prompt: "Which crew should I assign?",
        required: true,
        aliases: ["crew", "crew name"],
      },
      {
        key: "startsAt",
        label: "Start Time",
        prompt: "What start time should I use? Use ISO format or say skip for now.",
        required: false,
        aliases: ["start", "start time", "starts at"],
      },
      {
        key: "endsAt",
        label: "End Time",
        prompt: "What end time should I use? Use ISO format or say skip for 8 hours.",
        required: false,
        aliases: ["end", "end time", "ends at"],
      },
    ],
    async buildParams({ supabase, companyId, draft }) {
      const project = await resolveProjectIdByName(supabase, companyId, draft.project);
      if (project.error || !project.id) {
        return {
          params: null,
          fieldErrorKey: "project",
          fieldErrorMessage: project.error || "Project is required.",
        };
      }

      const crew = await resolveCrewIdByName(supabase, companyId, draft.crew);
      if (crew.error || !crew.id) {
        return {
          params: null,
          fieldErrorKey: "crew",
          fieldErrorMessage: crew.error || "Crew is required.",
        };
      }

      const start = trimToNull(draft.startsAt);
      const end = trimToNull(draft.endsAt);
      const startsAt = start && start !== "skip" ? start : new Date().toISOString();
      const endsAt = end && end !== "skip"
        ? end
        : new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString();

      return {
        params: {
          input: {
            projectId: project.id,
            crewId: crew.id,
            title: "Crew assignment",
            startsAt,
            endsAt,
            status: "assigned",
          },
        },
      };
    },
  },
  {
    id: "crew.create",
    noun: "crew",
    commandId: "crew.create",
    fields: [
      {
        key: "crewCode",
        label: "Crew Code",
        prompt: "What is the crew code?",
        required: true,
        aliases: ["crew code", "code"],
      },
      {
        key: "name",
        label: "Crew Name",
        prompt: "What is the crew name?",
        required: true,
        aliases: ["crew name", "name"],
      },
    ],
    async buildParams({ draft }) {
      return {
        params: {
          input: {
            crew_code: draft.crewCode,
            name: draft.name,
          },
        },
      };
    },
  },
];

const workflowsById = new Map(workflows.map((workflow) => [workflow.id, workflow]));

type WorkflowStartMatch = {
  workflowId: WorkflowId;
  initialDraft: Record<string, string>;
};

function extractCustomerCreateCompanyName(normalizedInput: string) {
  const namedMatch = normalizedInput.match(/\b(?:create|add|new|start)\s+(?:a\s+)?(?:new\s+)?customer\s+(?:named|called)\s+(.+)$/);
  if (!namedMatch) {
    return null;
  }

  const value = trimToNull(namedMatch[1]);
  return value || null;
}

function detectWorkflowStart(normalizedInput: string): WorkflowStartMatch | null {
  if (/\b(create|new|add|start)\s+(a\s+)?(new\s+)?customer\b/.test(normalizedInput)) {
    const proposedCompanyName = extractCustomerCreateCompanyName(normalizedInput);
    return {
      workflowId: "customer.create",
      initialDraft: proposedCompanyName
        ? { companyName: proposedCompanyName }
        : {},
    };
  }

  if (/\b(create|new|add)\s+(a\s+)?project\b/.test(normalizedInput)) {
    return {
      workflowId: "project.create",
      initialDraft: {},
    };
  }

  if (/\b(create|new|add)\s+(a\s+)?task\b/.test(normalizedInput)) {
    return {
      workflowId: "task.create",
      initialDraft: {},
    };
  }

  if (/\b(create|new|add)\s+(a\s+)?crew\b/.test(normalizedInput)) {
    return {
      workflowId: "crew.create",
      initialDraft: {},
    };
  }

  if (/\b(assign|dispatch)\s+crew\b/.test(normalizedInput) || /\b(dispatch)\s+assignment\b/.test(normalizedInput)) {
    return {
      workflowId: "project.assign_crew",
      initialDraft: {},
    };
  }

  return null;
}

function detectKnownButNotEnabledWorkflow(normalizedInput: string) {
  const patterns = [
    /\b(create|new|add)\s+(a\s+)?estimate\b/,
    /\b(create|new|add)\s+(an\s+)?invoice\b/,
    /\b(create|new|add)\s+(an\s+)?employee\b/,
    /\b(create|new|add)\s+(a\s+)?vendor\b/,
    /\b(create|new|add)\s+(equipment|asset)\b/,
    /\b(create|new|add)\s+material\b/,
    /\b(create|new|add)\s+(work order|workorder)\b/,
    /\b(create|new|add)\s+note\b/,
    /\b(create|new|add)\s+calendar\s+event\b/,
    /\b(create|new|add)\s+daily\s+report\b/,
    /\b(update|change)\s+company\s+settings\b/,
  ];

  return patterns.some((pattern) => pattern.test(normalizedInput));
}

function isStartOverPhrase(normalizedInput: string) {
  return /^(start over|restart|reset)$/.test(normalizedInput);
}

function startWorkflowSession(args: {
  key: string;
  definition: WorkflowDefinition;
  startMatch: WorkflowStartMatch;
}) {
  const firstField = args.definition.fields.find((field) => field.required);

  sessions.set(args.key, {
    workflowId: args.startMatch.workflowId,
    draft: { ...args.startMatch.initialDraft },
    awaitingConfirmation: false,
    startedAtMs: nowMs(),
    expiresAtMs: nowMs() + SESSION_TIMEOUT_MS,
  });

  return {
    handled: true as const,
    intent: emptyIntent(firstField ? firstField.prompt : `Let us create a ${args.definition.noun}.`),
    statusCategory: "workflow_collecting",
  };
}

async function maybeHandleExecutiveQuery(params: {
  supabase: SupabaseClient<Database>;
  workspace: WorkspaceContext;
  normalizedInput: string;
}): Promise<WorkflowHandlingResult> {
  const { supabase, workspace, normalizedInput } = params;
  const registry = createOrionCommandRegistry();

  if ((/\bschedule\b/.test(normalizedInput) && /\btoday\b/.test(normalizedInput)) || /what is on today s schedule/.test(normalizedInput)) {
    const command = registry.getById("schedule.read_range");
    if (!command) {
      return {
        handled: true,
        intent: emptyIntent("Schedule read is unavailable right now."),
        statusCategory: "workflow_query",
      };
    }

    return {
      handled: true,
      intent: commandIntent({
        command,
        commandParams: {
          rangeType: "day",
          rangeKey: "today",
          timezone: null,
        },
        message: "Reading today schedule.",
      }),
      statusCategory: "workflow_query",
    };
  }

  if (/\bhow many\b.*\bprojects\b.*\bactive\b/.test(normalizedInput) || /\bactive projects\b/.test(normalizedInput)) {
    const { data, error } = await supabase
      .from("projects")
      .select("id, status")
      .eq("company_id", workspace.companyId)
      .neq("status", "completed")
      .neq("status", "cancelled");

    if (error) {
      return {
        handled: true,
        intent: emptyIntent(error.message || "I could not read active projects right now."),
        statusCategory: "workflow_query",
      };
    }

    const count = data?.length || 0;
    return {
      handled: true,
      intent: emptyIntent(`You have ${count} active project${count === 1 ? "" : "s"}.`),
      statusCategory: "workflow_query",
    };
  }

  if (/\boverdue\b.*\binvoices\b/.test(normalizedInput)) {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("invoices")
      .select("id")
      .eq("company_id", workspace.companyId)
      .lt("due_date", today)
      .neq("status", "paid")
      .neq("status", "cancelled");

    if (error) {
      return {
        handled: true,
        intent: emptyIntent(error.message || "I could not read overdue invoices right now."),
        statusCategory: "workflow_query",
      };
    }

    const count = data?.length || 0;
    return {
      handled: true,
      intent: emptyIntent(`I found ${count} overdue invoice${count === 1 ? "" : "s"}.`),
      statusCategory: "workflow_query",
    };
  }

  if (/\bestimates\b/.test(normalizedInput) && /\b(waiting|pending|awaiting)\b/.test(normalizedInput)) {
    const { data, error } = await supabase
      .from("estimates")
      .select("id, status")
      .eq("company_id", workspace.companyId);

    if (error) {
      return {
        handled: true,
        intent: emptyIntent(error.message || "I could not read estimate status right now."),
        statusCategory: "workflow_query",
      };
    }

    const waitingStatuses = new Set(["draft", "sent", "viewed", "pending", "pending_approval"]);
    const waitingCount = (data || []).filter((item) => waitingStatuses.has(String(item.status || "").toLowerCase())).length;

    return {
      handled: true,
      intent: emptyIntent(`I found ${waitingCount} estimate${waitingCount === 1 ? "" : "s"} waiting.`),
      statusCategory: "workflow_query",
    };
  }

  if (/\bcrews\b/.test(normalizedInput) && /\bworking\b/.test(normalizedInput) && /\btoday\b/.test(normalizedInput)) {
    const repository = createWorkforceRepository(supabase);
    const assignments = await repository.listWorkforceAssignments(workspace.companyId);
    const nowIso = new Date().toISOString();

    const crewIds = new Set(
      assignments
        .filter((assignment) => assignment.crew_id && assignment.starts_at <= nowIso && assignment.ends_at >= nowIso)
        .map((assignment) => assignment.crew_id as string),
    );

    const count = crewIds.size;
    return {
      handled: true,
      intent: emptyIntent(`I found ${count} crew${count === 1 ? "" : "s"} working today.`),
      statusCategory: "workflow_query",
    };
  }

  if (/\bchanged\b/.test(normalizedInput) && /\byesterday\b/.test(normalizedInput)) {
    const since = new Date(Date.now() - (24 * 60 * 60 * 1000)).toISOString();
    const timeline = await createOrionTimelineService(supabase).listCompanyTimeline(workspace.companyId, {
      from: since,
      pageSize: 10,
    });

    const count = timeline.items.length;
    const first = timeline.items[0];
    if (!first) {
      return {
        handled: true,
        intent: emptyIntent("No workflow changes were recorded since yesterday."),
        statusCategory: "workflow_query",
      };
    }

    return {
      handled: true,
      intent: emptyIntent(`I found ${count} change${count === 1 ? "" : "s"} since yesterday. Latest: ${first.title}.`),
      statusCategory: "workflow_query",
    };
  }

  if (/\b(today s priorities|show today s priorities|what should i focus on|what should i focus)\b/.test(normalizedInput)) {
    const engine = createOrionDecisionEngine(supabase);
    const result = await engine.evaluateCompanyDecisions({
      companyId: workspace.companyId,
      actorProfileId: workspace.userId,
      companyName: workspace.companyName,
    });

    const top = result.topPriorities.slice(0, 3);
    if (top.length === 0) {
      return {
        handled: true,
        intent: emptyIntent("No critical priorities right now."),
        statusCategory: "workflow_query",
      };
    }

    const message = `Top priorities: ${top.map((item) => item.title).join("; ")}.`;
    return {
      handled: true,
      intent: emptyIntent(message),
      statusCategory: "workflow_query",
    };
  }

  return {
    handled: false,
    intent: null,
    statusCategory: null,
  };
}

export async function resolveVoiceWorkflowTurn(params: {
  supabase: SupabaseClient<Database>;
  workspace: WorkspaceContext;
  input: OrionIntentInput;
}): Promise<WorkflowHandlingResult> {
  cleanExpiredSessions();

  const normalized = normalizeInput(params.input.input || "");
  if (!normalized) {
    return {
      handled: false,
      intent: null,
      statusCategory: null,
    };
  }

  const currentKey = sessionKey(params.workspace.companyId, params.workspace.userId);
  const registry = createOrionCommandRegistry();
  const currentSession = sessions.get(currentKey);
  const workflowStart = detectWorkflowStart(normalized);

  if (workflowStart && workflowStart.workflowId === "customer.create" && (!currentSession || currentSession.workflowId === "customer.create")) {
    const definition = workflowsById.get(workflowStart.workflowId);
    if (!definition) {
      return {
        handled: true,
        intent: emptyIntent("That workflow is not available yet."),
        statusCategory: "workflow_not_enabled",
      };
    }

    return startWorkflowSession({
      key: currentKey,
      definition,
      startMatch: workflowStart,
    });
  }

  if (currentSession) {
    const definition = workflowsById.get(currentSession.workflowId);
    if (!definition) {
      sessions.delete(currentKey);
      return {
        handled: false,
        intent: null,
        statusCategory: null,
      };
    }

    if (isCancelPhrase(normalized)) {
      sessions.delete(currentKey);
      return {
        handled: true,
        intent: emptyIntent("Canceled."),
        statusCategory: "workflow_canceled",
      };
    }

    if (currentSession.workflowId === "customer.create" && isStartOverPhrase(normalized)) {
      const restartMatch: WorkflowStartMatch = {
        workflowId: "customer.create",
        initialDraft: {},
      };

      return startWorkflowSession({
        key: currentKey,
        definition,
        startMatch: restartMatch,
      });
    }

    const nextSession: WorkflowSession = {
      ...currentSession,
      expiresAtMs: nowMs() + SESSION_TIMEOUT_MS,
    };

    if (currentSession.awaitingConfirmation) {
      const explicit = parseExplicitFieldUpdate(definition.fields, normalized);
      if (explicit) {
        const normalizedField = validateAndNormalizeField(explicit.field, explicit.value);
        if (!normalizedField.ok) {
          sessions.set(currentKey, nextSession);
          return {
            handled: true,
            intent: emptyIntent(normalizedField.error || explicit.field.prompt),
            statusCategory: "workflow_collecting",
          };
        }

        nextSession.draft[explicit.field.key] = normalizedField.value;
        sessions.set(currentKey, nextSession);
        return {
          handled: true,
          intent: emptyIntent(formatWorkflowSummary(definition, nextSession.draft)),
          statusCategory: "workflow_awaiting_confirmation",
        };
      }

      if (isConfirmPhrase(normalized)) {
        const command = registry.getById(definition.commandId);
        if (!command) {
          sessions.delete(currentKey);
          return {
            handled: true,
            intent: emptyIntent("That workflow command is unavailable right now."),
            statusCategory: "workflow_not_enabled",
          };
        }

        const built = await definition.buildParams({
          supabase: params.supabase,
          companyId: params.workspace.companyId,
          draft: nextSession.draft,
        });

        if (!built.params) {
          if (built.fieldErrorKey) {
            nextSession.awaitingConfirmation = false;
          }

          sessions.set(currentKey, nextSession);
          return {
            handled: true,
            intent: emptyIntent(built.fieldErrorMessage || "I need one more field before saving."),
            statusCategory: "workflow_collecting",
          };
        }

        sessions.delete(currentKey);
        return {
          handled: true,
          intent: commandIntent({
            command,
            commandParams: built.params,
            message: `Saving ${definition.noun}.`,
          }),
          statusCategory: "workflow_ready_to_execute",
        };
      }

      if (isRejectPhrase(normalized)) {
        sessions.delete(currentKey);
        return {
          handled: true,
          intent: emptyIntent("Canceled."),
          statusCategory: "workflow_canceled",
        };
      }

      sessions.set(currentKey, nextSession);
      return {
        handled: true,
        intent: emptyIntent("Please say yes to save, or cancel."),
        statusCategory: "workflow_awaiting_confirmation",
      };
    }

    const explicit = parseExplicitFieldUpdate(definition.fields, normalized);
    const nextField = findNextField(definition, nextSession.draft);
    const field = explicit?.field || nextField;

    if (!field) {
      nextSession.awaitingConfirmation = true;
      sessions.set(currentKey, nextSession);
      return {
        handled: true,
        intent: emptyIntent(formatWorkflowSummary(definition, nextSession.draft)),
        statusCategory: "workflow_awaiting_confirmation",
      };
    }

    const value = explicit?.value || normalized;
    if (value === "skip" && field.required) {
      sessions.set(currentKey, nextSession);
      return {
        handled: true,
        intent: emptyIntent(`${field.label} is required. ${field.prompt}`),
        statusCategory: "workflow_collecting",
      };
    }

    const normalizedField = validateAndNormalizeField(field, value);
    if (!normalizedField.ok) {
      sessions.set(currentKey, nextSession);
      return {
        handled: true,
        intent: emptyIntent(normalizedField.error || field.prompt),
        statusCategory: "workflow_collecting",
      };
    }

    nextSession.draft[field.key] = normalizedField.value;

    const missing = findNextField(definition, nextSession.draft);
    if (!missing) {
      nextSession.awaitingConfirmation = true;
      sessions.set(currentKey, nextSession);
      return {
        handled: true,
        intent: emptyIntent(formatWorkflowSummary(definition, nextSession.draft)),
        statusCategory: "workflow_awaiting_confirmation",
      };
    }

    sessions.set(currentKey, nextSession);
    return {
      handled: true,
      intent: emptyIntent(missing.prompt),
      statusCategory: "workflow_collecting",
    };
  }

  const executive = await maybeHandleExecutiveQuery({
    supabase: params.supabase,
    workspace: params.workspace,
    normalizedInput: normalized,
  });

  if (executive.handled) {
    return executive;
  }

  if (workflowStart) {
    const definition = workflowsById.get(workflowStart.workflowId);
    if (!definition) {
      return {
        handled: true,
        intent: emptyIntent("That workflow is not available yet."),
        statusCategory: "workflow_not_enabled",
      };
    }

    return startWorkflowSession({
      key: currentKey,
      definition,
      startMatch: workflowStart,
    });
  }

  if (detectKnownButNotEnabledWorkflow(normalized)) {
    return {
      handled: true,
      intent: emptyIntent("That workflow is not voice-enabled in this batch. I can still open the module for you."),
      statusCategory: "workflow_not_enabled",
    };
  }

  return {
    handled: false,
    intent: null,
    statusCategory: null,
  };
}
