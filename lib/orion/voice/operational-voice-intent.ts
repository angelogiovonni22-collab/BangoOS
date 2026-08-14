import type { SupabaseClient } from "@supabase/supabase-js";
import { createOrionCommandRegistry } from "@/lib/orion/commands";
import type { OrionIntentInput, OrionIntentResult } from "@/lib/orion/intent-engine";
import type { WorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";
import { resolveProjectOpsVoiceIntent } from "./project-ops-voice-intent";

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function isDailyReportCreateRequest(input: string, pathname: string) {
  const text = normalize(input);
  const createVerb = /\b(create|make|start|new|begin)\b/.test(text);
  const explicitDailyReport = /\bdaily\s+report\b/.test(text);
  const reportOnDailyReportsPage = pathname.startsWith("/daily-reports") && /\breport\b/.test(text);
  const todaysReport = /\b(today|today s|todays)\s+report\b/.test(text);

  return createVerb && (explicitDailyReport || reportOnDailyReportsPage || todaysReport);
}

function isProjectHealthRequest(input: string, pathname: string) {
  const text = normalize(input);
  if (/\b(project health|project status|health of (?:the )?project|how is (?:this|the) project|how s (?:this|the) project|how is (?:this|the) job|how s (?:this|the) job)\b/.test(text)) {
    return true;
  }

  if (pathname.startsWith("/projects/") && /\b(how are we doing|how is it doing|status|health|project health)\b/.test(text)) {
    return true;
  }

  return /\b(?:health|status)\s+(?:of|for)\s+.+/.test(text) || /\bhow\s+is\s+.+\s+doing\b/.test(text);
}

function resolveReportDate(input: string) {
  const text = normalize(input);
  const explicit = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (explicit?.[1]) {
    return explicit[1];
  }

  const date = new Date();
  if (/\btomorrow\b/.test(text)) {
    date.setUTCDate(date.getUTCDate() + 1);
  } else if (/\byesterday\b/.test(text)) {
    date.setUTCDate(date.getUTCDate() - 1);
  }

  return date.toISOString().slice(0, 10);
}

function extractProjectPhrase(input: string) {
  const raw = input.trim();
  const dailyReport = raw.match(/\bfor\s+(?:project\s+)?(.+?)(?:\s+(?:today|tomorrow|yesterday|on\s+20\d{2}-\d{2}-\d{2}))?$/i);
  if (dailyReport?.[1]) {
    return dailyReport[1].trim();
  }

  const health = raw.match(/\b(?:health|status)\s+(?:of|for)\s+(?:project\s+)?(.+)$/i);
  if (health?.[1]) {
    return health[1].trim();
  }

  const howDoing = raw.match(/\bhow\s+is\s+(?:project\s+)?(.+?)\s+doing\??$/i);
  return howDoing?.[1]?.trim() || null;
}

async function resolveProject(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  routeProjectId: string | null;
  input: string;
}) {
  if (params.routeProjectId) {
    const { data, error } = await params.supabase
      .from("projects")
      .select("id, name")
      .eq("company_id", params.companyId)
      .eq("id", params.routeProjectId)
      .maybeSingle();

    if (!error && data) {
      return { id: data.id, name: data.name, ambiguous: false } as const;
    }
  }

  const phrase = extractProjectPhrase(params.input);
  if (!phrase) {
    return { id: null, name: null, ambiguous: false } as const;
  }

  const { data, error } = await params.supabase
    .from("projects")
    .select("id, name")
    .eq("company_id", params.companyId)
    .ilike("name", `%${phrase}%`)
    .limit(3);

  if (error || !data || data.length === 0) {
    return { id: null, name: null, ambiguous: false } as const;
  }

  if (data.length > 1) {
    return { id: null, name: null, ambiguous: true } as const;
  }

  return { id: data[0].id, name: data[0].name, ambiguous: false } as const;
}

function commandPreview(command: ReturnType<ReturnType<typeof createOrionCommandRegistry>["getById"]> extends never ? never : NonNullable<ReturnType<ReturnType<typeof createOrionCommandRegistry>["getById"]>>, target: string, expectedOutcome: string) {
  return {
    commandId: command.id,
    target,
    permission: command.requiredPermissions,
    confirmationLevel: command.confirmationLevel,
    expectedOutcome,
    eventsThatWillPublish: command.eventContract?.expectedEvents || [],
  };
}

export async function resolveOperationalVoiceIntent(params: {
  supabase: SupabaseClient<Database>;
  workspace: WorkspaceContext;
  input: OrionIntentInput;
}): Promise<{ handled: boolean; intent: OrionIntentResult | null; statusCategory: string | null }> {
  const projectOps = await resolveProjectOpsVoiceIntent(params);
  if (projectOps.handled) {
    return projectOps;
  }

  const projectHealthRequested = isProjectHealthRequest(params.input.input, params.input.route.pathname);
  const dailyReportRequested = isDailyReportCreateRequest(params.input.input, params.input.route.pathname);

  if (!projectHealthRequested && !dailyReportRequested) {
    return { handled: false, intent: null, statusCategory: null };
  }

  const project = await resolveProject({
    supabase: params.supabase,
    companyId: params.workspace.companyId,
    routeProjectId: params.input.route.projectId,
    input: params.input.input,
  });

  if (projectHealthRequested) {
    const command = createOrionCommandRegistry().getById("project.health_summary");
    if (!command || command.coverage.status !== "implemented") {
      return {
        handled: true,
        statusCategory: "command_unavailable",
        intent: {
          resolvedIntent: "view",
          resolvedEntity: null,
          confidence: 1,
          candidates: [],
          suggestedCommand: null,
          commandPreview: null,
          requiresClarification: false,
          message: "Project health is not available right now.",
        },
      };
    }

    if (project.ambiguous) {
      return {
        handled: true,
        statusCategory: "workflow_collecting",
        intent: {
          resolvedIntent: "view",
          resolvedEntity: null,
          confidence: 1,
          candidates: [],
          suggestedCommand: null,
          commandPreview: commandPreview(command, "project health", "Read the live project operational health summary."),
          requiresClarification: true,
          message: "I found more than one matching project. Please say the full project name.",
        },
      };
    }

    if (!project.id || !project.name) {
      return {
        handled: true,
        statusCategory: "workflow_collecting",
        intent: {
          resolvedIntent: "view",
          resolvedEntity: null,
          confidence: 1,
          candidates: [],
          suggestedCommand: null,
          commandPreview: commandPreview(command, "project health", "Read the live project operational health summary."),
          requiresClarification: false,
          message: "Which project's health would you like me to read? Open the project first or say the project name.",
        },
      };
    }

    return {
      handled: true,
      statusCategory: "operational_ready",
      intent: {
        resolvedIntent: "view",
        resolvedEntity: {
          entityType: "project",
          entityId: project.id,
          label: project.name,
        },
        confidence: 1,
        candidates: [],
        suggestedCommand: {
          commandId: command.id,
          params: { projectId: project.id },
          entityType: "project",
          entityId: project.id,
        },
        commandPreview: commandPreview(command, project.name, `Read the live project health summary for ${project.name}.`),
        requiresClarification: false,
        message: `Checking project health for ${project.name}.`,
      },
    };
  }

  const command = createOrionCommandRegistry().getById("daily_report.create");
  if (!command || command.coverage.status !== "implemented") {
    return {
      handled: true,
      statusCategory: "command_unavailable",
      intent: {
        resolvedIntent: "create",
        resolvedEntity: null,
        confidence: 1,
        candidates: [],
        suggestedCommand: null,
        commandPreview: null,
        requiresClarification: false,
        message: "Daily report creation is not available right now.",
      },
    };
  }

  if (project.ambiguous) {
    return {
      handled: true,
      statusCategory: "workflow_collecting",
      intent: {
        resolvedIntent: "create",
        resolvedEntity: null,
        confidence: 1,
        candidates: [],
        suggestedCommand: null,
        commandPreview: commandPreview(command, "daily report", "Create a daily report draft."),
        requiresClarification: true,
        message: "I found more than one matching project. Please say the full project name.",
      },
    };
  }

  if (!project.id || !project.name) {
    return {
      handled: true,
      statusCategory: "workflow_collecting",
      intent: {
        resolvedIntent: "create",
        resolvedEntity: null,
        confidence: 1,
        candidates: [],
        suggestedCommand: null,
        commandPreview: commandPreview(command, "daily report", "Create a daily report draft."),
        requiresClarification: false,
        message: "Which project is this daily report for? Open the project first or say the project name.",
      },
    };
  }

  const reportDate = resolveReportDate(params.input.input);
  return {
    handled: true,
    statusCategory: "operational_ready",
    intent: {
      resolvedIntent: "create",
      resolvedEntity: {
        entityType: "project",
        entityId: project.id,
        label: project.name,
      },
      confidence: 1,
      candidates: [],
      suggestedCommand: {
        commandId: command.id,
        params: {
          projectId: project.id,
          reportDate,
        },
        entityType: "project",
        entityId: project.id,
      },
      commandPreview: commandPreview(command, `${project.name} — ${reportDate}`, `Create a daily report draft for ${project.name} on ${reportDate}.`),
      requiresClarification: false,
      message: `Creating the ${reportDate} daily report for ${project.name}.`,
    },
  };
}
