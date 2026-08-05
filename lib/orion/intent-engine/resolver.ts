import { createOrionCommandRegistry } from "@/lib/orion/commands";
import type { OrionCommandDefinition, OrionCommandPermission } from "@/lib/orion/commands";
import { resolveDeterministicNavigationRoute } from "@/lib/orion/navigation";
import { normalizeIntentInput, parseEntityHint, parseIntent, normalizeIntentText } from "./parser";
import type {
  OrionIntentCandidate,
  OrionIntentCommandPreview,
  OrionIntentEntityRecord,
  OrionIntentEntityType,
  OrionIntentInput,
  OrionIntentKind,
  OrionIntentResult,
  OrionIntentRouteContext,
  OrionIntentSuggestedCommand,
} from "./types";

const STOPWORDS = new Set(["open", "show", "create", "update", "assign", "complete", "archive", "send", "view", "record", "payment", "deposit", "generate", "convert", "timeline", "dashboard", "priorities", "to", "the", "a", "an", "for", "in", "on", "at", "of"]);

const NICKNAME_MAP: Record<string, string[]> = {
  bob: ["robert"],
  rob: ["robert"],
  mike: ["michael"],
  liz: ["elizabeth"],
  bill: ["william"],
  jen: ["jennifer"],
  dave: ["david"],
};

function normalizeRole(role: string | null): OrionCommandPermission {
  const normalized = (role || "employee").trim().toLowerCase();

  if (normalized === "owner") return "owner";
  if (normalized === "admin" || normalized === "administrator") return "administrator";
  if (normalized === "operations_manager") return "operations_manager";
  if (normalized === "accountant") return "accountant";
  if (normalized === "project_manager") return "project_manager";
  if (normalized === "superintendent") return "superintendent";
  return "employee";
}

function compact(value: string) {
  return normalizeIntentText(value).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(input: string) {
  const base = compact(input).split(" ").filter(Boolean);
  const expanded: string[] = [];

  for (const token of base) {
    if (!STOPWORDS.has(token)) {
      expanded.push(token);
    }

    const aliases = NICKNAME_MAP[token] || [];
    for (const alias of aliases) {
      if (!STOPWORDS.has(alias)) {
        expanded.push(alias);
      }
    }
  }

  return [...new Set(expanded)];
}

function resolveDeterministicNavigation(input: string) {
  return resolveDeterministicNavigationRoute(input);
}

function detectInspectionType(input: string) {
  const normalized = compact(input);
  const known = [
    "framing",
    "electrical",
    "plumbing",
    "mechanical",
    "foundation",
    "final",
    "rough",
    "insulation",
    "fire",
  ];

  for (const type of known) {
    if (normalized.includes(type)) {
      return type;
    }
  }

  return "general";
}

function resolveNextWeekday(input: string) {
  const normalized = compact(input);
  const match = normalized.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (!match) {
    return null;
  }

  const weekdayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const target = weekdayMap[match[1]];
  const now = new Date();
  const date = new Date(now);
  let delta = target - date.getDay();
  if (delta <= 0) {
    delta += 7;
  }
  date.setDate(date.getDate() + delta);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}

function candidateBaseScore(params: {
  inputText: string;
  tokens: string[];
  candidate: OrionIntentEntityRecord;
  hintedType: OrionIntentEntityType | null;
}) {
  const searchable = [params.candidate.label, params.candidate.subtitle, ...params.candidate.terms].map(compact).join(" ");
  let score = 0;

  if (params.hintedType && params.candidate.entityType === params.hintedType) {
    score += 24;
  }

  const normalizedInput = compact(params.inputText);
  if (normalizedInput && searchable.includes(normalizedInput)) {
    score += 52;
  }

  for (const token of params.tokens) {
    if (searchable.includes(token)) {
      score += 18;
    }

    if (params.candidate.terms.some((term) => compact(term).startsWith(token))) {
      score += 12;
    }
  }

  return score;
}

function contextBoost(params: {
  candidate: OrionIntentEntityRecord;
  route: OrionIntentRouteContext;
  recentEntityKeys: string[];
}) {
  let score = 0;
  const key = `${params.candidate.entityType}:${params.candidate.entityId}`;

  if (params.recentEntityKeys.includes(key)) {
    score += 20;
  }

  if (params.route.projectId && params.candidate.entityType === "project" && params.route.projectId === params.candidate.entityId) {
    score += 34;
  }

  if (params.route.projectId && params.candidate.projectId && params.route.projectId === params.candidate.projectId) {
    score += 30;
  }

  if (params.route.customerId && params.candidate.entityType === "customer" && params.route.customerId === params.candidate.entityId) {
    score += 34;
  }

  if (params.route.customerId && params.candidate.customerId && params.route.customerId === params.candidate.customerId) {
    score += 22;
  }

  if (params.route.estimateId && params.candidate.entityType === "estimate" && params.route.estimateId === params.candidate.entityId) {
    score += 34;
  }

  if (params.route.invoiceId && params.candidate.entityType === "invoice" && params.route.invoiceId === params.candidate.entityId) {
    score += 34;
  }

  if (params.route.employeeId && params.candidate.entityType === "employee" && params.route.employeeId === params.candidate.entityId) {
    score += 34;
  }

  if (params.route.crewId && params.candidate.entityType === "crew" && params.route.crewId === params.candidate.entityId) {
    score += 34;
  }

  if (params.route.pathname.includes("/projects") && params.candidate.entityType === "project") {
    score += 10;
  }

  if (params.route.pathname.includes("/customers") && params.candidate.entityType === "customer") {
    score += 10;
  }

  return score;
}

function expectedOutcomeForCommand(command: OrionCommandDefinition) {
  if (command.coverage.status === "unsupported") {
    return command.coverage.reason || "Command unavailable.";
  }

  if (command.id.endsWith(".open") || command.id.endsWith(".view")) {
    return "Open the requested workspace.";
  }

  return "Run command and publish workflow events.";
}

function buildCommandPreview(command: OrionCommandDefinition, target: string): OrionIntentCommandPreview {
  return {
    commandId: command.id,
    target,
    permission: command.requiredPermissions,
    confirmationLevel: command.confirmationLevel,
    expectedOutcome: expectedOutcomeForCommand(command),
    eventsThatWillPublish: command.eventContract?.expectedEvents || [],
  };
}

function findAllowedCommand(commandsById: Map<string, OrionCommandDefinition>, commandId: string) {
  return commandsById.get(commandId) || null;
}

function buildCommandResolution(params: {
  intent: OrionIntentKind;
  entity: OrionIntentEntityRecord | null;
  commandsById: Map<string, OrionCommandDefinition>;
  route: OrionIntentRouteContext;
  inputText: string;
}): { suggested: OrionIntentSuggestedCommand | null; preview: OrionIntentCommandPreview | null; message: string | null } {
  const { intent, entity, commandsById, route, inputText } = params;
  if (intent === "inspection_schedule") {
    if (entity?.entityType === "inspection") {
      const reinspection = normalizeIntentText(inputText).includes("reinspection");
      const commandId = reinspection ? "inspection.schedule_reinspection" : "inspection.schedule";
      const command = findAllowedCommand(commandsById, commandId);
      if (!command) {
        return { suggested: null, preview: null, message: "You do not have permission to schedule inspections." };
      }

      const scheduledAt = resolveNextWeekday(inputText) || new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString();
      return {
        suggested: {
          commandId: command.id,
          params: commandId === "inspection.schedule_reinspection"
            ? { inspectionId: entity.entityId, reinspectionDate: scheduledAt }
            : { inspectionId: entity.entityId, scheduledAt },
          entityType: "inspection",
          entityId: entity.entityId,
        },
        preview: buildCommandPreview(command, entity.label),
        message: null,
      };
    }

    const projectId = route.projectId || (entity?.entityType === "project" ? entity.entityId : null);
    if (!projectId) {
      return { suggested: null, preview: null, message: "Open a project before scheduling an inspection." };
    }

    const command = findAllowedCommand(commandsById, "inspection.create");
    if (!command) {
      return { suggested: null, preview: null, message: "You do not have permission to create inspections." };
    }

    const scheduledAt = resolveNextWeekday(inputText);
    return {
      suggested: {
        commandId: command.id,
        params: {
          projectId,
          inspectionType: detectInspectionType(inputText),
          scheduledAt,
        },
        entityType: "project",
        entityId: projectId,
      },
      preview: buildCommandPreview(command, `/projects/${projectId}/inspections`),
      message: null,
    };
  }

  if (intent === "inspection_pass" || intent === "inspection_fail") {
    const commandId = intent === "inspection_pass" ? "inspection.pass" : "inspection.fail";
    const command = findAllowedCommand(commandsById, commandId);
    if (!command) {
      return { suggested: null, preview: null, message: "You do not have permission to record inspection results." };
    }

    if (!entity || entity.entityType !== "inspection") {
      return { suggested: null, preview: null, message: "Select a specific inspection before recording results." };
    }

    return {
      suggested: {
        commandId: command.id,
        params: { inspectionId: entity.entityId },
        entityType: "inspection",
        entityId: entity.entityId,
      },
      preview: buildCommandPreview(command, entity.label),
      message: null,
    };
  }

  if (intent === "inspection_reinspection") {
    const command = findAllowedCommand(commandsById, "inspection.schedule_reinspection");
    if (!command) {
      return { suggested: null, preview: null, message: "You do not have permission to schedule reinspections." };
    }

    if (!entity || entity.entityType !== "inspection") {
      return { suggested: null, preview: null, message: "Select the failed inspection first." };
    }

    const reinspectionDate = resolveNextWeekday(inputText);
    if (!reinspectionDate) {
      return { suggested: null, preview: null, message: "Specify a reinspection day, for example Friday." };
    }

    return {
      suggested: {
        commandId: command.id,
        params: { inspectionId: entity.entityId, reinspectionDate },
        entityType: "inspection",
        entityId: entity.entityId,
      },
      preview: buildCommandPreview(command, entity.label),
      message: null,
    };
  }

  if (intent === "permit_submit" || intent === "permit_approve" || intent === "permit_issue" || intent === "permit_reject") {
    const commandMap: Record<string, string> = {
      permit_submit: "permit.submit",
      permit_approve: "permit.approve",
      permit_issue: "permit.issue",
      permit_reject: "permit.reject",
    };
    const command = findAllowedCommand(commandsById, commandMap[intent]);
    if (!command) {
      return { suggested: null, preview: null, message: "You do not have permission to update permits." };
    }

    if (!entity || entity.entityType !== "permit") {
      return { suggested: null, preview: null, message: "Select a permit before updating permit status." };
    }

    const paramsOut: Record<string, unknown> = { permitId: entity.entityId };
    if (intent === "permit_reject") {
      paramsOut.reason = "Rejected via Orion command center";
    }

    return {
      suggested: {
        commandId: command.id,
        params: paramsOut,
        entityType: "permit",
        entityId: entity.entityId,
      },
      preview: buildCommandPreview(command, entity.label),
      message: null,
    };
  }

  if (intent === "customer_update_log") {
    const command = findAllowedCommand(commandsById, "customer_update.log_phone_call");
    if (!command) {
      return { suggested: null, preview: null, message: "You do not have permission to log customer updates." };
    }

    const projectId = route.projectId || entity?.projectId || (entity?.entityType === "project" ? entity.entityId : null);
    if (!projectId) {
      return { suggested: null, preview: null, message: "Open a project workspace before logging customer updates." };
    }

    return {
      suggested: {
        commandId: command.id,
        params: {
          projectId,
          message: "Customer update logged from Orion intent.",
        },
        entityType: "project",
        entityId: projectId,
      },
      preview: buildCommandPreview(command, `/projects/${projectId}/communications`),
      message: null,
    };
  }


  const navigationCommand = findAllowedCommand(commandsById, "dashboard.open");

  if (intent === "show_dashboard" && navigationCommand) {
    const href = "/dashboard";
    return {
      suggested: {
        commandId: navigationCommand.id,
        params: { entityType: "workflow", entityId: "dashboard", deepLink: href },
        entityType: "dashboard",
        entityId: "dashboard",
      },
      preview: buildCommandPreview(navigationCommand, href),
      message: null,
    };
  }

  if (intent === "show_timeline" && navigationCommand) {
    const href = entity ? `/timeline?${entity.entityType}Id=${entity.entityId}` : "/timeline";
    return {
      suggested: {
        commandId: navigationCommand.id,
        params: { entityType: "workflow", entityId: "timeline", deepLink: href },
        entityType: "timeline",
        entityId: "timeline",
      },
      preview: buildCommandPreview(navigationCommand, href),
      message: null,
    };
  }

  if (intent === "show_priorities" && navigationCommand) {
    const href = "/dashboard?widgetId=top-priorities";
    return {
      suggested: {
        commandId: navigationCommand.id,
        params: { entityType: "workflow", entityId: "dashboard", deepLink: href },
        entityType: "dashboard",
        entityId: "dashboard",
      },
      preview: buildCommandPreview(navigationCommand, href),
      message: null,
    };
  }

  if (intent === "record_payment") {
    const command = findAllowedCommand(commandsById, "invoice.record_payment");
    if (!command) {
      return { suggested: null, preview: null, message: "You do not have permission to record payment." };
    }

    if (!entity || entity.entityType !== "invoice") {
      return { suggested: null, preview: null, message: "Select an invoice to record payment." };
    }

    return {
      suggested: {
        commandId: command.id,
        params: { invoiceId: entity.entityId, action: "record_payment" },
        entityType: "invoice",
        entityId: entity.entityId,
      },
      preview: buildCommandPreview(command, entity.label),
      message: null,
    };
  }

  if (intent === "record_deposit") {
    const command = findAllowedCommand(commandsById, "invoice.record_deposit");
    if (!command) {
      return { suggested: null, preview: null, message: "You do not have permission to record deposit." };
    }

    if (!entity || entity.entityType !== "invoice") {
      return { suggested: null, preview: null, message: "Select an invoice to record deposit." };
    }

    return {
      suggested: {
        commandId: command.id,
        params: { invoiceId: entity.entityId },
        entityType: "invoice",
        entityId: entity.entityId,
      },
      preview: buildCommandPreview(command, entity.label),
      message: "Amount is required before final execution.",
    };
  }

  if (intent === "send") {
    const command = findAllowedCommand(commandsById, "estimate.send") || findAllowedCommand(commandsById, "invoice.send");
    if (!command) {
      return { suggested: null, preview: null, message: "No send command available for your role." };
    }

    if (!entity || (entity.entityType !== "estimate" && entity.entityType !== "invoice")) {
      return { suggested: null, preview: null, message: "Select an estimate or invoice to send." };
    }

    if (entity.entityType === "estimate") {
      const estimateSend = findAllowedCommand(commandsById, "estimate.send");
      if (!estimateSend) {
        return { suggested: null, preview: null, message: "You do not have permission to send estimates." };
      }

      return {
        suggested: {
          commandId: estimateSend.id,
          params: { estimateId: entity.entityId },
          entityType: "estimate",
          entityId: entity.entityId,
        },
        preview: buildCommandPreview(estimateSend, entity.label),
        message: null,
      };
    }

    const invoiceSend = findAllowedCommand(commandsById, "invoice.send");
    if (!invoiceSend) {
      return { suggested: null, preview: null, message: "You do not have permission to send invoices." };
    }

    return {
      suggested: {
        commandId: invoiceSend.id,
        params: { invoiceId: entity.entityId, action: "send" },
        entityType: "invoice",
        entityId: entity.entityId,
      },
      preview: buildCommandPreview(invoiceSend, entity.label),
      message: null,
    };
  }

  if (intent === "convert_estimate" || intent === "generate_invoice") {
    const commandId = intent === "convert_estimate" ? "estimate.convert" : "estimate.generate_deposit_invoice";
    const command = findAllowedCommand(commandsById, commandId);
    if (!command) {
      return { suggested: null, preview: null, message: "You do not have permission for this estimate workflow." };
    }

    const estimateId = entity?.entityType === "estimate"
      ? entity.entityId
      : route.estimateId;

    if (!estimateId) {
      return { suggested: null, preview: null, message: "Select an estimate first." };
    }

    return {
      suggested: {
        commandId: command.id,
        params: {
          estimateId,
          action: intent === "convert_estimate" ? "convert" : "deposit_invoice",
        },
        entityType: "estimate",
        entityId: estimateId,
      },
      preview: buildCommandPreview(command, estimateId),
      message: null,
    };
  }

  if (intent === "start") {
    const command = findAllowedCommand(commandsById, "task.start");
    if (!command) {
      return { suggested: null, preview: null, message: "You do not have permission to start tasks." };
    }

    if (!entity || entity.entityType !== "task") {
      return { suggested: null, preview: null, message: "Select a task to start." };
    }

    return {
      suggested: {
        commandId: command.id,
        params: { taskId: entity.entityId },
        entityType: "task",
        entityId: entity.entityId,
      },
      preview: buildCommandPreview(command, entity.label),
      message: null,
    };
  }

  if (intent === "pause") {
    const command = findAllowedCommand(commandsById, "task.pause");
    if (!command) {
      return { suggested: null, preview: null, message: "You do not have permission to pause tasks." };
    }

    if (!entity || entity.entityType !== "task") {
      return { suggested: null, preview: null, message: "Select a task to pause." };
    }

    return {
      suggested: {
        commandId: command.id,
        params: { taskId: entity.entityId },
        entityType: "task",
        entityId: entity.entityId,
      },
      preview: buildCommandPreview(command, entity.label),
      message: null,
    };
  }

  if (intent === "complete") {
    if (entity?.entityType === "task") {
      const command = findAllowedCommand(commandsById, "task.complete");
      if (!command) {
        return { suggested: null, preview: null, message: "You do not have permission to complete tasks." };
      }

      return {
        suggested: {
          commandId: command.id,
          params: { taskId: entity.entityId },
          entityType: "task",
          entityId: entity.entityId,
        },
        preview: buildCommandPreview(command, entity.label),
        message: null,
      };
    }

    if (entity?.entityType === "project") {
      const command = findAllowedCommand(commandsById, "project.complete");
      if (!command) {
        return { suggested: null, preview: null, message: "You do not have permission to complete projects." };
      }

      return {
        suggested: {
          commandId: command.id,
          params: { projectId: entity.entityId },
          entityType: "project",
          entityId: entity.entityId,
        },
        preview: buildCommandPreview(command, entity.label),
        message: null,
      };
    }
  }

  if (intent === "assign" && entity?.entityType === "crew") {
    const command = findAllowedCommand(commandsById, "project.assign_crew");
    if (!command) {
      return { suggested: null, preview: null, message: "You do not have permission to assign crews." };
    }

    const projectId = route.projectId;
    if (!projectId) {
      return { suggested: null, preview: null, message: "Open a project workspace before assigning a crew." };
    }

    return {
      suggested: {
        commandId: command.id,
        params: {
          input: {
            projectId,
            crewId: entity.entityId,
            title: `Crew assignment ${entity.label}`,
          },
        },
        entityType: "crew",
        entityId: entity.entityId,
      },
      preview: buildCommandPreview(command, `${entity.label} -> project`),
      message: null,
    };
  }

  if ((intent === "open" || intent === "view" || intent === "navigation" || intent === "search" || intent === "show_dashboard") && entity) {
    const openCommandIdByEntity: Partial<Record<OrionIntentEntityType, string>> = {
      customer: "customer.open",
      project: "project.open",
      estimate: "estimate.open",
      invoice: "invoice.open",
      employee: "employee.open",
      crew: "crew.open",
      inspection: "inspection.open",
      permit: "permit.open",
      communication: "customer_update.open",
      document: "document.view",
      operations: "dashboard.open",
      settings: "dashboard.open",
      dashboard: "dashboard.open",
      timeline: "dashboard.open",
      task: "dashboard.open",
    };

    const commandId = openCommandIdByEntity[entity.entityType] || "dashboard.open";
    const command = findAllowedCommand(commandsById, commandId);
    if (!command) {
      return { suggested: null, preview: null, message: "You do not have permission for this command." };
    }

    let deepLink = `/${entity.entityType}s?${entity.entityType}Id=${entity.entityId}`;
    if (entity.entityType === "dashboard") deepLink = "/dashboard";
    if (entity.entityType === "timeline") deepLink = "/timeline";
    if (entity.entityType === "settings") deepLink = "/settings";
    if (entity.entityType === "operations") deepLink = "/operations";
    if (entity.entityType === "inspection") {
      const projectId = entity.projectId || route.projectId;
      deepLink = projectId ? `/projects/${projectId}/inspections?inspectionId=${entity.entityId}` : "/projects";
    }
    if (entity.entityType === "permit") {
      const projectId = entity.projectId || route.projectId;
      deepLink = projectId ? `/projects/${projectId}/permits?permitId=${entity.entityId}` : "/projects";
    }
    if (entity.entityType === "communication") {
      const projectId = entity.projectId || route.projectId;
      deepLink = projectId ? `/projects/${projectId}/communications?communicationId=${entity.entityId}` : "/projects";
    }

    return {
      suggested: {
        commandId: command.id,
        params: {
          entityType: command.entityType,
          entityId: entity.entityId,
          deepLink,
        },
        entityType: entity.entityType,
        entityId: entity.entityId,
      },
      preview: buildCommandPreview(command, deepLink),
      message: null,
    };
  }

  if (intent === "create" || intent === "generate_estimate") {
    const command = findAllowedCommand(commandsById, "dashboard.open");
    if (!command) {
      return { suggested: null, preview: null, message: "You do not have permission for create navigation." };
    }

    const hintedEstimate = intent === "generate_estimate" || entity?.entityType === "estimate";
    const deepLink = hintedEstimate
      ? `/estimates/new${route.customerId ? `?customerId=${route.customerId}` : ""}`
      : `/projects/new${route.customerId ? `?customerId=${route.customerId}` : ""}`;

    return {
      suggested: {
        commandId: command.id,
        params: {
          entityType: "workflow",
          entityId: "create",
          deepLink,
        },
        entityType: null,
        entityId: null,
      },
      preview: buildCommandPreview(command, deepLink),
      message: null,
    };
  }

  return { suggested: null, preview: null, message: "No matching command mapping for the detected intent." };
}

export function resolveIntentFromEntitySet(params: {
  input: OrionIntentInput;
  role: OrionCommandPermission;
  entities: OrionIntentEntityRecord[];
  recentEntityKeys?: string[];
}): OrionIntentResult {
  const normalizedInput = normalizeIntentInput(params.input.input);
  if (!normalizedInput) {
    return {
      resolvedIntent: null,
      resolvedEntity: null,
      confidence: 0,
      candidates: [],
      suggestedCommand: null,
      commandPreview: null,
      requiresClarification: false,
      message: "Enter a command or search phrase.",
    };
  }

  const intent = parseIntent(normalizedInput);
  const hintedEntity = parseEntityHint(normalizedInput);
  const tokens = tokenize(normalizedInput);
  const recentKeys = params.recentEntityKeys || [];

  const registry = createOrionCommandRegistry();
  const allowedCommands = registry.list().filter((command) => command.requiredPermissions.includes(params.role));
  const commandsById = new Map(allowedCommands.map((command) => [command.id, command]));

  const deterministicNavigation = resolveDeterministicNavigation(normalizedInput);
  if (deterministicNavigation) {
    const command = commandsById.get(deterministicNavigation.commandId);
    if (!command) {
      return {
        resolvedIntent: deterministicNavigation.resolvedIntent,
        resolvedEntity: {
          entityType: deterministicNavigation.entityType,
          entityId: deterministicNavigation.entityId,
          label: deterministicNavigation.entityId,
        },
        confidence: deterministicNavigation.confidence,
        candidates: [],
        suggestedCommand: null,
        commandPreview: null,
        requiresClarification: false,
        message: "You do not have permission for this navigation command.",
      };
    }

    return {
      resolvedIntent: deterministicNavigation.resolvedIntent,
      resolvedEntity: {
        entityType: deterministicNavigation.entityType,
        entityId: deterministicNavigation.entityId,
        label: deterministicNavigation.entityId,
      },
      confidence: deterministicNavigation.confidence,
      candidates: [],
      suggestedCommand: {
        commandId: command.id,
        params: {
          entityType: "workflow",
          entityId: deterministicNavigation.entityId,
          deepLink: deterministicNavigation.deepLink,
        },
        entityType: deterministicNavigation.entityType,
        entityId: deterministicNavigation.entityId,
      },
      commandPreview: buildCommandPreview(command, deterministicNavigation.deepLink),
      requiresClarification: false,
      message: "Intent resolved.",
    };
  }

  const scored = params.entities
    .map((candidate) => {
      const baseScore = candidateBaseScore({
        inputText: normalizedInput,
        tokens,
        candidate,
        hintedType: hintedEntity,
      });

      if (baseScore <= 0) {
        return {
          candidate,
          score: 0,
        };
      }

      const score = baseScore + contextBoost({
        candidate,
        route: params.input.route,
        recentEntityKeys: recentKeys,
      });

      return {
        candidate,
        score,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const candidates: OrionIntentCandidate[] = scored.slice(0, 6).map((entry) => ({
    entityType: entry.candidate.entityType,
    entityId: entry.candidate.entityId,
    label: entry.candidate.label,
    subtitle: entry.candidate.subtitle,
    score: entry.score,
  }));

  const allowRouteOnlyResolution = intent === "inspection_schedule" || intent === "customer_update_log";

  if (candidates.length === 0 && !allowRouteOnlyResolution && hintedEntity !== "dashboard" && hintedEntity !== "timeline" && hintedEntity !== "settings" && hintedEntity !== "operations") {
    return {
      resolvedIntent: intent,
      resolvedEntity: null,
      confidence: 0,
      candidates: [],
      suggestedCommand: null,
      commandPreview: null,
      requiresClarification: false,
      message: "No matching record found.",
    };
  }

  let selected = candidates[0] || null;

  if (params.input.selectedCandidateId) {
    const explicit = candidates.find((candidate) => candidate.entityId === params.input.selectedCandidateId);
    if (explicit) {
      selected = explicit;
    }
  }

  const requiresClarification = Boolean(
    !params.input.selectedCandidateId
    && candidates.length > 1
    && candidates[0]
    && candidates[1]
    && (candidates[0].score - candidates[1].score) <= 8,
  );

  const resolvedEntityRecord = selected
    ? params.entities.find((entry) => entry.entityType === selected.entityType && entry.entityId === selected.entityId) || null
    : null;

  const commandResolution = buildCommandResolution({
    intent,
    entity: resolvedEntityRecord,
    commandsById,
    route: params.input.route,
    inputText: normalizedInput,
  });

  const hasNavKeyword = /(dashboard|projects|customers|estimates|invoices|timeline|schedule)/.test(normalizedInput);
  const confidence = selected
    ? Math.min(1, Number((selected.score / 120).toFixed(2)))
    : hasNavKeyword
      ? 0.72
      : 0.35;

  if (requiresClarification) {
    return {
      resolvedIntent: intent,
      resolvedEntity: resolvedEntityRecord
        ? {
          entityType: resolvedEntityRecord.entityType,
          entityId: resolvedEntityRecord.entityId,
          label: resolvedEntityRecord.label,
        }
        : null,
      confidence,
      candidates,
      suggestedCommand: null,
      commandPreview: null,
      requiresClarification: true,
      message: "Multiple matches found. Please select a specific record.",
    };
  }

  return {
    resolvedIntent: intent,
    resolvedEntity: resolvedEntityRecord
      ? {
        entityType: resolvedEntityRecord.entityType,
        entityId: resolvedEntityRecord.entityId,
        label: resolvedEntityRecord.label,
      }
      : null,
    confidence,
    candidates,
    suggestedCommand: commandResolution.suggested,
    commandPreview: commandResolution.preview,
    requiresClarification: Boolean(commandResolution.message && !commandResolution.suggested),
    message: commandResolution.message || "Intent resolved.",
  };
}

export function resolveIntentWithRole(params: {
  input: OrionIntentInput;
  role: string | null;
  entities: OrionIntentEntityRecord[];
  recentEntityKeys?: string[];
}) {
  return resolveIntentFromEntitySet({
    input: params.input,
    role: normalizeRole(params.role),
    entities: params.entities,
    recentEntityKeys: params.recentEntityKeys,
  });
}
