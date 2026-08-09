import type { SupabaseClient } from "@supabase/supabase-js";
import { createOrionCommandRegistry } from "@/lib/orion/commands";
import type { OrionIntentInput, OrionIntentResult } from "@/lib/orion/intent-engine";
import type { WorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";

type ProjectOpsIntent = "workforce" | "change_orders";

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function detectProjectOpsIntent(input: string): ProjectOpsIntent | null {
  const text = normalize(input);

  if (/\b(who is scheduled|who s scheduled|who is assigned|who s assigned|who is working|who s working|who is on (?:this|the) (?:job|project)|crew on (?:this|the) (?:job|project)|team on (?:this|the) (?:job|project))\b/.test(text)) {
    return "workforce";
  }

  if (/\b(outstanding|open|pending|active)\s+change\s+orders?\b/.test(text) || /\bchange\s+orders?\s+(?:on|for)\s+(?:this|the)\s+(?:job|project)\b/.test(text)) {
    return "change_orders";
  }

  return null;
}

function extractProjectName(input: string, intent: ProjectOpsIntent) {
  const raw = input.trim();
  const generic = raw.match(/\b(?:for|on)\s+(?:project\s+)?(.+?)\??$/i);
  if (generic?.[1] && !/^(this|the)\s+(job|project)$/i.test(generic[1].trim())) {
    return generic[1].trim();
  }

  if (intent === "workforce") {
    const who = raw.match(/\bwho\s+(?:is|s)\s+(?:scheduled|assigned|working)\s+(?:on|for)\s+(.+?)\??$/i);
    if (who?.[1] && !/^(this|the)\s+(job|project)$/i.test(who[1].trim())) {
      return who[1].trim();
    }
  }

  return null;
}

async function resolveProject(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  routeProjectId: string | null;
  input: string;
  intent: ProjectOpsIntent;
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

  const phrase = extractProjectName(params.input, params.intent);
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

export async function resolveProjectOpsVoiceIntent(params: {
  supabase: SupabaseClient<Database>;
  workspace: WorkspaceContext;
  input: OrionIntentInput;
}): Promise<{ handled: boolean; intent: OrionIntentResult | null; statusCategory: string | null }> {
  const detected = detectProjectOpsIntent(params.input.input);
  if (!detected) {
    return { handled: false, intent: null, statusCategory: null };
  }

  const commandId = detected === "workforce" ? "project.workforce_summary" : "project.change_order_summary";
  const command = createOrionCommandRegistry().getById(commandId);
  if (!command || command.coverage.status !== "implemented") {
    return {
      handled: true,
      intent: {
        resolvedIntent: "view",
        resolvedEntity: null,
        confidence: 1,
        candidates: [],
        suggestedCommand: null,
        commandPreview: null,
        requiresClarification: false,
        message: detected === "workforce" ? "Project workforce data is unavailable right now." : "Project change order data is unavailable right now.",
      },
      statusCategory: "command_unavailable",
    };
  }

  const project = await resolveProject({
    supabase: params.supabase,
    companyId: params.workspace.companyId,
    routeProjectId: params.input.route.projectId,
    input: params.input.input,
    intent: detected,
  });

  const expectedOutcome = detected === "workforce"
    ? "Read the live workforce assigned to the project."
    : "Read outstanding project change order decisions.";

  if (project.ambiguous || !project.id || !project.name) {
    return {
      handled: true,
      intent: {
        resolvedIntent: "view",
        resolvedEntity: null,
        confidence: 1,
        candidates: [],
        suggestedCommand: null,
        commandPreview: {
          commandId: command.id,
          target: detected === "workforce" ? "project workforce" : "project change orders",
          permission: command.requiredPermissions,
          confirmationLevel: command.confirmationLevel,
          expectedOutcome,
          eventsThatWillPublish: [],
        },
        requiresClarification: project.ambiguous,
        message: project.ambiguous
          ? "I found more than one matching project. Please say the full project name."
          : "Which project do you mean? Open the project first or say the project name.",
      },
      statusCategory: "workflow_collecting",
    };
  }

  return {
    handled: true,
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
      commandPreview: {
        commandId: command.id,
        target: project.name,
        permission: command.requiredPermissions,
        confirmationLevel: command.confirmationLevel,
        expectedOutcome,
        eventsThatWillPublish: [],
      },
      requiresClarification: false,
      message: detected === "workforce" ? `Checking who is assigned to ${project.name}.` : `Checking outstanding change orders for ${project.name}.`,
    },
    statusCategory: "operational_ready",
  };
}
