import { createOrionCommandRegistry } from "@/lib/orion/commands";
import type { OrionCommandDefinition, OrionCommandPermission } from "@/lib/orion/commands";
import { resolveDeterministicNavigationRoute } from "@/lib/orion/navigation";
import { normalizeIntentInput, parseEntityHint, parseIntent, parseScheduleReadPhrase, normalizeIntentText } from "./parser";
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CustomerMatchTier = 1 | 2 | 3 | 4 | 5 | 6 | 7;

type RankedCustomerCandidate = {
  record: OrionIntentEntityRecord;
  tier: CustomerMatchTier;
  score: number;
  discriminator: string | null;
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

function normalizeLookupText(value: string) {
  return normalizeIntentText(value)
    .replace(/[\s.,!?;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactLookupDisplay(value: string) {
  return value
    .replace(/[\s.,!?;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCustomerLookupTerm(input: string) {
  const raw = compactLookupDisplay(input);
  if (!raw) {
    return "";
  }

  const patterns = [
    /^(open|show|view|find|search|lookup|go to|navigate to|update|edit|archive|restore)\s+(the\s+)?(customer|client|cust)\s+/i,
    /^(customer|client|cust)\s+/i,
  ];

  let value = raw;
  for (const pattern of patterns) {
    value = value.replace(pattern, "");
  }

  return compactLookupDisplay(value);
}

function extractCreateCustomerProposedName(input: string) {
  const match = compactLookupDisplay(input).match(/\b(?:create|add|new)\s+(?:a\s+)?(?:new\s+)?(?:customer|client|cust)\s+(?:named|called)\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const value = compactLookupDisplay(match[1]);
  return value || null;
}

function extractDigits(value: string) {
  return value.replace(/\D/g, "");
}

function asDistinct<T>(values: T[]) {
  return [...new Set(values)];
}

function readCandidateEmails(candidate: OrionIntentEntityRecord) {
  const sources = [candidate.label, ...candidate.terms];
  return asDistinct(
    sources
      .map((value) => value.trim().toLowerCase())
      .filter((value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)),
  );
}

function readCandidatePhones(candidate: OrionIntentEntityRecord) {
  const sources = [candidate.label, ...candidate.terms];
  return asDistinct(
    sources
      .map((value) => extractDigits(value))
      .filter((digits) => digits.length >= 7),
  );
}

function readCandidateStrings(candidate: OrionIntentEntityRecord) {
  return asDistinct(
    [candidate.label, ...candidate.terms]
      .map((value) => normalizeLookupText(value))
      .filter(Boolean),
  );
}

function candidateDiscriminator(candidate: OrionIntentEntityRecord) {
  const emails = readCandidateEmails(candidate);
  if (emails.length > 0) {
    return `email ${emails[0]}`;
  }

  const phones = readCandidatePhones(candidate);
  if (phones.length > 0) {
    const phone = phones[0];
    return `phone ending in ${phone.slice(-4)}`;
  }

  const location = candidate.terms
    .map((value) => normalizeLookupText(value))
    .find((value) => value.includes(" ") && !value.includes("@") && extractDigits(value).length < 7);

  if (location) {
    return `location ${location}`;
  }

  return `ID ${candidate.entityId.slice(0, 8)}`;
}

function rankCustomerCandidate(query: string, candidate: OrionIntentEntityRecord): RankedCustomerCandidate | null {
  const normalizedQuery = normalizeLookupText(query);
  if (!normalizedQuery) {
    return null;
  }

  const queryDigits = extractDigits(normalizedQuery);
  const queryIsUuid = UUID_PATTERN.test(normalizedQuery);
  const queryLooksLikeEmail = normalizedQuery.includes("@");

  const strings = readCandidateStrings(candidate);
  const emails = readCandidateEmails(candidate);
  const phones = readCandidatePhones(candidate);

  const exactStringMatch = strings.some((value) => value === normalizedQuery);
  const exactEmailMatch = queryLooksLikeEmail && emails.includes(normalizedQuery);
  const exactPhoneMatch = queryDigits.length >= 7 && phones.includes(queryDigits);
  const prefixMatch = strings.some((value) => value.startsWith(normalizedQuery));
  const fuzzyMatch = strings.some((value) => value.includes(normalizedQuery));

  let tier: CustomerMatchTier | null = null;
  let score = 0;

  if (queryIsUuid && candidate.entityId.toLowerCase() === normalizedQuery.toLowerCase()) {
    tier = 1;
    score = 1000;
  } else if (exactStringMatch) {
    tier = 2;
    score = 900;
  } else if (exactEmailMatch) {
    tier = 4;
    score = 700;
  } else if (exactPhoneMatch) {
    tier = 5;
    score = 650;
  } else if (prefixMatch) {
    tier = 6;
    score = 500;
  } else if (fuzzyMatch) {
    tier = 7;
    score = 350;
  }

  if (!tier) {
    return null;
  }

  return {
    record: candidate,
    tier,
    score,
    discriminator: candidateDiscriminator(candidate),
  };
}

function isCustomerSelectionIntent(intent: OrionIntentKind, normalizedInput: string, hintedEntity: OrionIntentEntityType | null) {
  if (intent === "create" || intent === "generate_estimate" || intent === "start") {
    return false;
  }

  if (hintedEntity === "customer") {
    return true;
  }

  const mentionsCustomer = /\b(customer|client|cust)\b/.test(normalizedInput);
  if (!mentionsCustomer) {
    return false;
  }

  return intent === "open"
    || intent === "view"
    || intent === "search"
    || intent === "update"
    || intent === "archive"
    || /\brestore\b/.test(normalizedInput);
}

function formatCustomerAmbiguityMessage(queryDisplay: string, queryNormalized: string, matches: RankedCustomerCandidate[]) {
  const distinctNames = asDistinct(matches.map((entry) => normalizeLookupText(entry.record.label)));
  const exactDuplicateName = distinctNames.length === 1 && distinctNames[0] === queryNormalized;
  const displayName = queryDisplay.trim() || "that customer";

  if (matches.length === 2 && exactDuplicateName) {
    const first = matches[0].discriminator || `ID ${matches[0].record.entityId.slice(0, 8)}`;
    const second = matches[1].discriminator || `ID ${matches[1].record.entityId.slice(0, 8)}`;
    return `I found two customers named ${displayName}. One has ${first} and one has ${second}. Which one do you mean?`;
  }

  const options = matches
    .slice(0, 3)
    .map((entry) => `${entry.record.label} (${entry.discriminator || `ID ${entry.record.entityId.slice(0, 8)}`})`)
    .join("; ");

  return `I found multiple customers matching ${displayName}: ${options}. Which one do you mean?`;
}

function resolveCustomerCandidates(params: {
  intent: OrionIntentKind;
  normalizedInput: string;
  hintedEntity: OrionIntentEntityType | null;
  entities: OrionIntentEntityRecord[];
  selectedCandidateId?: string | null;
}) {
  if (!isCustomerSelectionIntent(params.intent, params.normalizedInput, params.hintedEntity)) {
    return null;
  }

  const queryDisplay = extractCustomerLookupTerm(params.normalizedInput);
  if (!queryDisplay) {
    return null;
  }

  const query = normalizeLookupText(queryDisplay);

  const rankedById = new Map<string, RankedCustomerCandidate>();

  for (const candidate of params.entities) {
    if (candidate.entityType !== "customer") {
      continue;
    }

    const ranked = rankCustomerCandidate(query, candidate);
    if (!ranked) {
      continue;
    }

    const existing = rankedById.get(candidate.entityId);
    if (!existing || ranked.score > existing.score) {
      rankedById.set(candidate.entityId, ranked);
    }
  }

  const ranked = [...rankedById.values()].sort((a, b) => b.score - a.score);
  if (ranked.length === 0) {
    return {
      query,
      candidates: [] as OrionIntentCandidate[],
      selected: null as OrionIntentCandidate | null,
      requiresClarification: false,
      message: `I couldn't find a customer named ${queryDisplay}.`,
    };
  }

  const bestTier = ranked[0].tier;
  const bestMatches = ranked.filter((entry) => entry.tier === bestTier);
  const rankedCandidates = bestMatches.map((entry) => ({
    entityType: "customer" as OrionIntentEntityType,
    entityId: entry.record.entityId,
    label: entry.record.label,
    subtitle: entry.discriminator ? `${entry.record.subtitle} • ${entry.discriminator}` : entry.record.subtitle,
    score: entry.score,
  }));

  let selected = rankedCandidates[0] || null;
  if (params.selectedCandidateId) {
    const explicit = rankedCandidates.find((candidate) => candidate.entityId === params.selectedCandidateId);
    if (explicit) {
      selected = explicit;
    }
  }

  const requiresClarification = rankedCandidates.length > 1 && !params.selectedCandidateId;
  const message = requiresClarification
    ? formatCustomerAmbiguityMessage(queryDisplay, query, bestMatches)
    : null;

  return {
    query: queryDisplay,
    candidates: rankedCandidates,
    selected,
    requiresClarification,
    message,
  };
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

function resolveCreateSemanticTarget(params: {
  intent: OrionIntentKind;
  hintedEntity: OrionIntentEntityType | null;
  inputText: string;
}) {
  const normalized = compact(params.inputText);
  const contains = (pattern: RegExp) => pattern.test(normalized);

  const createIntentFromStart = params.intent === "start" && contains(/\b(start|begin)\b\s+(a|an)?\s*(project|estimate|invoice|customer|client)\b/);
  const createIntent = params.intent === "create" || params.intent === "generate_estimate" || createIntentFromStart;

  if (!createIntent) {
    return null;
  }

  const wantsEstimate = params.intent === "generate_estimate"
    || params.hintedEntity === "estimate"
    || contains(/\bestimate\b|\bquote\b|\best\b/);
  if (wantsEstimate) {
    return {
      commandId: "estimate.create",
      missingDataPrompt: "Which customer is this estimate for?",
    } as const;
  }

  const wantsInvoice = params.hintedEntity === "invoice" || contains(/\binvoice\b|\bbill\b|\binv\b/);
  if (wantsInvoice) {
    return {
      commandId: "invoice.create",
      missingDataPrompt: "Which customer or project is this invoice for?",
    } as const;
  }

  const wantsCustomer = params.hintedEntity === "customer" || contains(/\bcustomer\b|\bclient\b|\bcust\b/);
  if (wantsCustomer) {
    return {
      commandId: "customer.create",
      missingDataPrompt: "What is the customer name?",
    } as const;
  }

  const wantsTask = params.hintedEntity === "task" || contains(/\btask\b|\btodo\b/);
  if (wantsTask) {
    return {
      commandId: "task.create",
      missingDataPrompt: "Which project should this task belong to?",
    } as const;
  }

  const wantsProject = params.hintedEntity === "project" || contains(/\bproject\b|\bjob\b|\bproj\b/);
  if (wantsProject) {
    return {
      commandId: "project.create",
      missingDataPrompt: "What would you like to name the project?",
    } as const;
  }

  return null;
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
  hintedEntity: OrionIntentEntityType | null;
}): { suggested: OrionIntentSuggestedCommand | null; preview: OrionIntentCommandPreview | null; message: string | null } {
  const { intent, entity, commandsById, route, inputText, hintedEntity } = params;
  const normalizedInput = normalizeLookupText(inputText);

  if (entity?.entityType === "customer") {
    if (intent === "archive") {
      const command = findAllowedCommand(commandsById, "customer.archive");
      if (!command) {
        return { suggested: null, preview: null, message: "You do not have permission to archive customers." };
      }

      return {
        suggested: {
          commandId: command.id,
          params: { customerId: entity.entityId },
          entityType: "customer",
          entityId: entity.entityId,
        },
        preview: buildCommandPreview(command, `/customers/${entity.entityId}`),
        message: null,
      };
    }

    if (/\brestore\b/.test(normalizedInput)) {
      const command = findAllowedCommand(commandsById, "customer.restore");
      if (!command) {
        return { suggested: null, preview: null, message: "You do not have permission to restore customers." };
      }

      return {
        suggested: {
          commandId: command.id,
          params: { customerId: entity.entityId },
          entityType: "customer",
          entityId: entity.entityId,
        },
        preview: buildCommandPreview(command, `/customers/${entity.entityId}`),
        message: null,
      };
    }

    if (intent === "update") {
      const command = findAllowedCommand(commandsById, "customer.update");
      if (!command) {
        return { suggested: null, preview: null, message: "You do not have permission to update customers." };
      }

      return {
        suggested: null,
        preview: buildCommandPreview(command, entity.label),
        message: `I found ${entity.label}. What would you like to update?`,
      };
    }
  }

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

  const createTarget = resolveCreateSemanticTarget({
    intent,
    hintedEntity,
    inputText,
  });

  if (createTarget) {
    const command = findAllowedCommand(commandsById, createTarget.commandId);
    if (!command) {
      return { suggested: null, preview: null, message: "You do not have permission for this create command." };
    }

    const contextHints: string[] = [];
    if (entity?.entityType === "customer") {
      contextHints.push(`Customer in context: ${entity.label}.`);
    }
    if (entity?.entityType === "project") {
      contextHints.push(`Project in context: ${entity.label}.`);
    }

    return {
      suggested: null,
      preview: buildCommandPreview(command, command.name),
      message: `${createTarget.missingDataPrompt}${contextHints.length > 0 ? ` ${contextHints.join(" ")}` : ""}`,
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

  if ((intent === "open" || intent === "view" || intent === "navigation") && hintedEntity === "task" && navigationCommand) {
    return {
      suggested: {
        commandId: navigationCommand.id,
        params: { entityType: "workflow", entityId: "tasks", deepLink: "/projects" },
        entityType: "workflow",
        entityId: "tasks",
      },
      preview: buildCommandPreview(navigationCommand, "/projects"),
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

  const scheduleRead = parseScheduleReadPhrase(normalizedInput);
  if (scheduleRead) {
    const command = commandsById.get("schedule.read_range");
    if (!command) {
      return {
        resolvedIntent: "view",
        resolvedEntity: null,
        confidence: 0.97,
        candidates: [],
        suggestedCommand: null,
        commandPreview: null,
        requiresClarification: false,
        message: "You do not have permission to read the schedule.",
      };
    }

    return {
      resolvedIntent: "view",
      resolvedEntity: null,
      confidence: 0.97,
      candidates: [],
      suggestedCommand: {
        commandId: command.id,
        params: {
          rangeType: scheduleRead.rangeType,
          rangeKey: scheduleRead.rangeKey,
        },
        entityType: null,
        entityId: null,
      },
      commandPreview: buildCommandPreview(command, `schedule ${scheduleRead.label}`),
      requiresClarification: false,
      message: "Intent resolved.",
    };
  }

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
        params: command.id === "navigation.back"
          ? {
            fallbackHref: deterministicNavigation.deepLink || "/dashboard",
            navigationAction: "back",
          }
          : {
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

  const explicitCustomerCreate = intent === "create"
    && hintedEntity === "customer"
    && /\b(customer|client|cust)\b/.test(normalizedInput);

  if (explicitCustomerCreate) {
    const command = commandsById.get("customer.create");
    if (!command) {
      return {
        resolvedIntent: intent,
        resolvedEntity: null,
        confidence: 0.95,
        candidates: [],
        suggestedCommand: null,
        commandPreview: null,
        requiresClarification: false,
        message: "You do not have permission for this create command.",
      };
    }

    const proposedName = extractCreateCustomerProposedName(normalizedInput);
    const prompt = proposedName
      ? `I captured ${proposedName} as the proposed customer name. What is the customer first name?`
      : "What is the customer name?";

    return {
      resolvedIntent: intent,
      resolvedEntity: null,
      confidence: 0.99,
      candidates: [],
      suggestedCommand: null,
      commandPreview: buildCommandPreview(command, command.name),
      requiresClarification: true,
      message: prompt,
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

  let candidates: OrionIntentCandidate[] = scored.slice(0, 6).map((entry) => ({
    entityType: entry.candidate.entityType,
    entityId: entry.candidate.entityId,
    label: entry.candidate.label,
    subtitle: entry.candidate.subtitle,
    score: entry.score,
  }));

  const allowRouteOnlyResolution = intent === "inspection_schedule"
    || intent === "customer_update_log"
    || intent === "create"
    || intent === "generate_estimate";

  const customerResolution = resolveCustomerCandidates({
    intent,
    normalizedInput,
    hintedEntity,
    entities: params.entities,
    selectedCandidateId: params.input.selectedCandidateId,
  });

  if (customerResolution?.candidates.length) {
    candidates = customerResolution.candidates;
  }

  if (customerResolution && customerResolution.candidates.length === 0) {
    return {
      resolvedIntent: intent,
      resolvedEntity: null,
      confidence: 0,
      candidates: [],
      suggestedCommand: null,
      commandPreview: null,
      requiresClarification: false,
      message: customerResolution.message || "No matching record found.",
    };
  }

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

  let selected = customerResolution?.selected || candidates[0] || null;

  if (params.input.selectedCandidateId) {
    const explicit = candidates.find((candidate) => candidate.entityId === params.input.selectedCandidateId);
    if (explicit) {
      selected = explicit;
    }
  }

  const requiresClarification = customerResolution
    ? customerResolution.requiresClarification
    : Boolean(
      !allowRouteOnlyResolution
      &&
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
    hintedEntity,
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
      message: customerResolution?.message || "Multiple matches found. Please select a specific record.",
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
