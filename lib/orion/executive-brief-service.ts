import type { SupabaseClient } from "@supabase/supabase-js";
import { buildDeterministicLearningContext } from "@/lib/bango-intelligence/learning/learning-service";
import { SupabaseLearningProvider } from "@/lib/bango-intelligence/learning/learning-provider";
import { SupabaseMemoryProvider } from "@/lib/bango-intelligence/memory/supabase-memory-provider";
import { buildMemorySummary } from "@/lib/bango-intelligence/memory/memory-summary";
import type { DashboardSectionErrors, ExecutiveDashboardData } from "@/lib/dashboard/types";
import type { Database } from "@/types/database.types";
import {
  buildExecutiveCompanySummary,
  buildExecutiveGreeting,
  buildExecutiveHealthSummary,
  buildExecutiveLimitations,
  buildExecutiveNotifications,
  buildExecutivePriorityItems,
  buildExecutiveQuickCommands,
} from "./executive-brief-mappers";
import { deriveExecutiveReadinessState } from "./executive-status";
import type { ExecutiveBrief, ExecutiveBriefBuildInput, ExecutiveCommandResult } from "./executive-brief-types";

type BuildExecutiveBriefParams = {
  supabase: SupabaseClient<Database>;
  companyId: string;
  companyName: string | null;
  companyRole: string | null;
  dashboardData: ExecutiveDashboardData;
  dashboardSectionErrors: DashboardSectionErrors;
  localeTag: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  now?: Date;
};

export async function buildExecutiveBrief(params: BuildExecutiveBriefParams): Promise<ExecutiveBrief> {
  const now = params.now ?? new Date();
  const learningProvider = new SupabaseLearningProvider(params.supabase);
  const memoryProvider = new SupabaseMemoryProvider(params.supabase);

  const [learning, memoryRecords] = await Promise.all([
    buildDeterministicLearningContext(learningProvider, {
      companyId: params.companyId,
      projectId: null,
      customerId: null,
      nowIso: now.toISOString(),
    }),
    memoryProvider.findRecords({
      companyId: params.companyId,
      roleId: params.companyRole ?? "employee",
      maxResults: 24,
      requestType: "executive_overview",
    }),
  ]);

  const memorySummary = buildMemorySummary(memoryRecords, []);
  const input: ExecutiveBriefBuildInput = {
    companyId: params.companyId,
    companyName: params.companyName,
    companyRole: params.companyRole,
    dashboardData: params.dashboardData,
    dashboardSectionErrors: params.dashboardSectionErrors,
    learning,
    memorySummary,
    now,
    localeTag: params.localeTag,
    t: params.t,
  };

  const limitations = buildExecutiveLimitations(input);
  const priorityItems = buildExecutivePriorityItems(input);
  const readinessState = deriveExecutiveReadinessState({
    sectionErrors: params.dashboardSectionErrors,
    limitations,
    priorityItems,
  });

  return {
    greeting: buildExecutiveGreeting(input),
    companySummary: buildExecutiveCompanySummary(input),
    healthSummary: buildExecutiveHealthSummary(input),
    priorityItems,
    notifications: buildExecutiveNotifications(input),
    readinessState,
    limitations,
    generatedAt: now.toISOString(),
    quickCommands: buildExecutiveQuickCommands(params.t),
  };
}

export function routeExecutiveCommand(input: string, brief: ExecutiveBrief, t: BuildExecutiveBriefParams["t"]): ExecutiveCommandResult {
  const normalized = input.trim().toLowerCase();
  const commands = new Map(brief.quickCommands.map((command) => [command.example.toLowerCase(), command]));
  const directMatch = commands.get(normalized);

  if (directMatch) {
    return {
      supported: true,
      message: t("orion.commandSupported", { command: directMatch.example }),
      href: directMatch.href,
    };
  }

  if (normalized === "show overdue invoices") {
    return { supported: true, message: t("orion.commandSupported", { command: input.trim() }), href: "/invoices" };
  }

  if (normalized === "show overdue tasks" || normalized === "show blocked tasks" || normalized === "show active projects") {
    return { supported: true, message: t("orion.commandSupported", { command: input.trim() }), href: "/projects" };
  }

  return {
    supported: false,
    message: t("orion.commandUnavailable"),
    href: null,
  };
}