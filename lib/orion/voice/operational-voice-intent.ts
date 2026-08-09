import type { SupabaseClient } from "@supabase/supabase-js";
import { createOrionCommandRegistry } from "@/lib/orion/commands";
import type { OrionIntentInput, OrionIntentResult } from "@/lib/orion/intent-engine";
import type { WorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";

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
  const match = raw.match(/\bfor\s+(?:project\s+)?(.+?)(?:\s+(?:today|tomorrow|yesterday|on\s+20\d{2}-\d{2}-\d{2}))?$/i);
  return match?.[1]?.trim() || null;
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

export async function resolveOperationalVoiceIntent(params: {
  supabase: SupabaseClient<Database>;
  workspace: WorkspaceContext;
  input: OrionIntentInput;
}): Promise<{ handled: boolean; intent: OrionIntentResult | null; statusCategory: string | null }> {
  if (!isDailyReportCreateRequest(params.input.input, params.input.route.pathname)) {
    return { handled: false, intent: null, statusCategory: null };
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

  const project = await resolveProject({
    supabase: params.supabase,
    companyId: params.workspace.companyId,
    routeProjectId: params.input.route.projectId,
    input: params.input.input,
  });

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
        commandPreview: {
          commandId: command.id,
          target: "daily report",
          permission: command.requiredPermissions,
          confirmationLevel: command.confirmationLevel,
          expectedOutcome: "Create a daily report draft.",
          eventsThatWillPublish: command.eventContract?.expectedEvents || [],
        },
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
        commandPreview: {
          commandId: command.id,
          target: "daily report",
          permission: command.requiredPermissions,
          confirmationLevel: command.confirmationLevel,
          expectedOutcome: "Create a daily report draft.",
          eventsThatWillPublish: command.eventContract?.expectedEvents || [],
        },
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
      commandPreview: {
        commandId: command.id,
        target: `${project.name} — ${reportDate}`,
        permission: command.requiredPermissions,
        confirmationLevel: command.confirmationLevel,
        expectedOutcome: `Create a daily report draft for ${project.name} on ${reportDate}.`,
        eventsThatWillPublish: command.eventContract?.expectedEvents || [],
      },
      requiresClarification: false,
      message: `Creating the ${reportDate} daily report for ${project.name}.`,
    },
  };
}
