import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { calculateProjectIntelligence } from "@/lib/project-intelligence/calculate-project-intelligence";
import { generateProjectBriefing } from "@/lib/project-intelligence/briefing/generate-project-briefing";
import type { Database } from "@/types/database.types";
import type {
  BangoBusinessContext,
  BangoCoreRequest,
  BangoIdentityMembership,
  BangoProjectContext,
  DeterministicIntelligenceSummary,
} from "./context-types";

if (typeof window !== "undefined") {
  throw new Error("bango-intelligence/core/context-builder must run on the server.");
}

type BuildContextSuccess = {
  ok: true;
  context: BangoBusinessContext;
};

type BuildContextFailure = {
  ok: false;
  status: number;
  error: string;
};

export type BuildBangoBusinessContextResult = BuildContextSuccess | BuildContextFailure;

export async function buildBangoBusinessContext(
  input: BangoCoreRequest & { requestId: string },
  supabaseArg?: SupabaseClient<Database>,
): Promise<BuildBangoBusinessContextResult> {
  const supabase = supabaseArg ?? await createClient();
  if (!supabase) {
    return { ok: false, status: 503, error: "Service unavailable." };
  }

  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) {
    return { ok: false, status: 401, error: "Authentication required." };
  }

  const workspaceContext = workspace.context;

  const membershipResult = await supabase
    .from("company_memberships")
    .select("id, company_id, role, status, is_primary")
    .eq("user_id", workspaceContext.userId)
    .eq("company_id", workspaceContext.companyId)
    .eq("status", "active")
    .order("is_primary", { ascending: false });

  if (membershipResult.error || !membershipResult.data || membershipResult.data.length === 0) {
    return { ok: false, status: 403, error: "Active company membership is required." };
  }

  const memberships: BangoIdentityMembership[] = membershipResult.data.map((membership) => ({
    membershipId: membership.id,
    companyId: membership.company_id,
    role: membership.role,
    status: membership.status,
    isPrimary: membership.is_primary,
  }));

  const [companyResult, profileResult] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, timezone, default_tax_rate")
      .eq("id", workspaceContext.companyId)
      .maybeSingle(),
    supabase
      .from("user_profiles")
      .select("id, display_name, first_name, last_name, role")
      .eq("user_id", workspaceContext.userId)
      .maybeSingle(),
  ]);

  if (companyResult.error || !companyResult.data) {
    return { ok: false, status: 403, error: "Company context unavailable." };
  }

  const company = companyResult.data;
  const profile = profileResult.data;

  const scopeProjectId = trimNullable(input.projectId);
  const scopeCustomerId = trimNullable(input.customerId);
  const scopePhaseId = trimNullable(input.phaseId);
  const scopeTaskId = trimNullable(input.taskId);

  let projectContext: BangoProjectContext | null = null;

  if (scopeProjectId) {
    const projectResult = await supabase
      .from("projects")
      .select("id, company_id, name, status, customer_id, project_number, estimated_end_date, contract_amount, estimated_cost, description")
      .eq("id", scopeProjectId)
      .eq("company_id", workspaceContext.companyId)
      .maybeSingle();

    if (projectResult.error || !projectResult.data) {
      return { ok: false, status: 404, error: "Project not found or access denied." };
    }

    const project = projectResult.data;

    if (scopeCustomerId && project.customer_id && project.customer_id !== scopeCustomerId) {
      return { ok: false, status: 403, error: "Cross-company or mismatched customer scope denied." };
    }

    const [tasksResult, invoicesResult, estimatesCountResult, changeOrdersCountResult, photosCountResult] =
      await Promise.all([
        supabase
          .from("tasks")
          .select("id, status, completion_percentage, planned_finish, assigned_profile_id, phase_id")
          .eq("company_id", workspaceContext.companyId)
          .eq("project_id", scopeProjectId),
        supabase
          .from("invoices")
          .select("id, total_amount, amount_paid, due_date")
          .eq("company_id", workspaceContext.companyId)
          .eq("project_id", scopeProjectId),
        supabase
          .from("estimates")
          .select("id", { count: "exact", head: true })
          .eq("company_id", workspaceContext.companyId)
          .eq("project_id", scopeProjectId),
        supabase
          .from("change_orders")
          .select("id", { count: "exact", head: true })
          .eq("company_id", workspaceContext.companyId)
          .eq("project_id", scopeProjectId),
        supabase
          .from("project_photos")
          .select("id", { count: "exact", head: true })
          .eq("company_id", workspaceContext.companyId)
          .eq("project_id", scopeProjectId),
      ]);

    const intelligence = calculateProjectIntelligence({
      project: {
        status: project.status,
        estimated_end_date: project.estimated_end_date,
        contract_amount: project.contract_amount ?? null,
        estimated_cost: project.estimated_cost ?? null,
        description: project.description ?? null,
      },
      tasks: (tasksResult.data ?? []).map((task) => ({
        id: task.id,
        status: task.status,
        completion_percentage: task.completion_percentage,
        planned_finish: task.planned_finish,
        assigned_profile_id: task.assigned_profile_id,
        phase_id: task.phase_id,
      })),
      invoices: (invoicesResult.data ?? []).map((invoice) => ({
        total_amount: invoice.total_amount,
        amount_paid: invoice.amount_paid,
        due_date: invoice.due_date,
      })),
      counts: {
        estimates: estimatesCountResult.count ?? 0,
        changeOrders: changeOrdersCountResult.count ?? 0,
        photos: photosCountResult.count ?? 0,
      },
    });

    const briefing = generateProjectBriefing({
      intelligence,
      projectId: scopeProjectId,
      projectName: project.name,
      localeTag: input.locale,
      userDisplayName: resolveDisplayName(profile),
    });

    const intelligenceSummary: DeterministicIntelligenceSummary = {
      healthScore: intelligence.summary.healthScore,
      healthStatus: intelligence.summary.healthStatus,
      completionPercent: intelligence.summary.completionPercent,
      activeTasks: intelligence.summary.activeTasks,
      overdueTasks: intelligence.summary.overdueTasks,
      blockedTasks: intelligence.summary.blockedTasks,
      activePhasesCount: intelligence.summary.activePhasesCount,
      tasksDueToday: intelligence.schedule.tasksDueToday,
      tasksDueThisWeek: intelligence.schedule.tasksDueThisWeek,
      daysUntilDue: intelligence.schedule.daysUntilDue,
      photosCount: intelligence.quality.photosCount,
      documentationPresent: intelligence.quality.documentationPresent,
      assignedWorkers: intelligence.workforce.assignedWorkers,
      unassignedTaskCount: intelligence.workforce.unassignedTaskCount,
      contractAmount: intelligence.budget.contractAmount,
      invoicePaid: intelligence.budget.invoicePaid,
      invoiceTotal: intelligence.budget.invoiceTotal,
      budgetVariance: intelligence.budget.budgetVariance,
      overdueInvoices: intelligence.budget.overdueInvoices,
      estimatesCount: intelligence.budget.estimatesCount,
      changeOrdersCount: intelligence.budget.changeOrdersCount,
      highestRiskSeverity: intelligence.risk.highestSeverity,
      riskCount: intelligence.risk.risks.length,
      risks: intelligence.risk.risks.map((risk) => ({
        id: risk.id,
        severity: risk.severity,
        message: risk.message,
      })),
    };

    projectContext = {
      id: project.id,
      name: project.name,
      status: project.status,
      customerId: project.customer_id,
      projectNumber: project.project_number,
      intelligence: intelligenceSummary,
      briefing: {
        state: briefing.state,
        briefingDate: briefing.metadata.briefingDate,
        generatedAt: briefing.metadata.generatedAt,
        executiveSummaryKey: briefing.executiveSummaryKey,
        focusCount: briefing.focusItems.length,
        riskCount: briefing.riskItems.length,
        actionCount: briefing.recommendedActions.length,
      },
    };
  }

  if (scopeCustomerId) {
    const customerResult = await supabase
      .from("customers")
      .select("id")
      .eq("id", scopeCustomerId)
      .eq("company_id", workspaceContext.companyId)
      .maybeSingle();

    if (customerResult.error || !customerResult.data) {
      return { ok: false, status: 403, error: "Cross-company customer scope denied." };
    }
  }

  if (scopePhaseId) {
    const phaseResult = await supabase
      .from("project_phases")
      .select("id, project_id")
      .eq("id", scopePhaseId)
      .eq("company_id", workspaceContext.companyId)
      .maybeSingle();

    if (phaseResult.error || !phaseResult.data) {
      return { ok: false, status: 403, error: "Cross-company phase scope denied." };
    }

    if (scopeProjectId && phaseResult.data.project_id !== scopeProjectId) {
      return { ok: false, status: 403, error: "Phase does not belong to requested project." };
    }
  }

  if (scopeTaskId) {
    const taskResult = await supabase
      .from("tasks")
      .select("id, project_id")
      .eq("id", scopeTaskId)
      .eq("company_id", workspaceContext.companyId)
      .maybeSingle();

    if (taskResult.error || !taskResult.data) {
      return { ok: false, status: 403, error: "Cross-company task scope denied." };
    }

    if (scopeProjectId && taskResult.data.project_id !== scopeProjectId) {
      return { ok: false, status: 403, error: "Task does not belong to requested project." };
    }
  }

  return {
    ok: true,
    context: {
      request: {
        requestId: input.requestId,
        requestType: input.requestType,
        locale: input.locale,
        timestamp: new Date().toISOString(),
      },
      identity: {
        userId: workspaceContext.userId,
        companyId: workspaceContext.companyId,
        profileId: profile?.id ?? workspaceContext.userId,
        displayName: resolveDisplayName(profile),
        companyRole: profile?.role ?? workspaceContext.role,
        memberships,
      },
      scope: {
        companyId: workspaceContext.companyId,
        projectId: scopeProjectId,
        customerId: scopeCustomerId,
        phaseId: scopePhaseId,
        taskId: scopeTaskId,
      },
      company: {
        id: company.id,
        name: company.name,
        timezone: company.timezone,
        defaultTaxRate: company.default_tax_rate,
      },
      project: projectContext,
      permissions: {
        allowedCapabilities: [],
        deniedCapabilities: [],
        approvalRequirements: {},
      },
      evidence: [],
      limitations: [],
    },
  };
}

function resolveDisplayName(
  profile: { display_name: string | null; first_name: string | null; last_name: string | null } | null,
): string | null {
  if (!profile) {
    return null;
  }

  if (profile.display_name && profile.display_name.trim().length > 0) {
    return profile.display_name.trim();
  }

  const first = profile.first_name?.trim() ?? "";
  const last = profile.last_name?.trim() ?? "";
  const fullName = `${first} ${last}`.trim();
  return fullName.length > 0 ? fullName : null;
}

function trimNullable(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
