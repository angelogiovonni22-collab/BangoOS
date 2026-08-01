import type { ProjectRisk, RiskSeverity, RiskIntelligence } from "./intelligence-types";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

type RiskTaskInput = {
  status: string;
  planned_finish: string | null;
  assigned_profile_id: string | null;
};

type RiskInvoiceInput = {
  total_amount: number;
  amount_paid: number;
  due_date: string | null;
};

type RiskProjectInput = {
  status: string | null;
  estimated_end_date: string | null;
  contract_amount: number | null;
  estimated_cost: number | null;
  description: string | null;
};

type RiskCountsInput = {
  photos: number;
};

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Produces structured risk items derived entirely from already-loaded workspace
 * data. No values are invented; each risk rule references a concrete signal.
 */
export function buildRiskIntelligence(
  project: RiskProjectInput,
  tasks: RiskTaskInput[],
  invoices: RiskInvoiceInput[],
  counts: RiskCountsInput,
): RiskIntelligence {
  const todayIso = todayString();
  const risks: ProjectRisk[] = [];

  const nonCompletedTasks = tasks.filter((t) => !isCompletedOrCancelled(t.status));
  const overdueTasks = nonCompletedTasks.filter(
    (t) => t.planned_finish !== null && t.planned_finish < todayIso,
  );
  const blockedTasks = tasks.filter(
    (t) => t.status.trim().toLowerCase() === "blocked",
  );
  const unassignedOpenTasks = nonCompletedTasks.filter(
    (t) => !t.assigned_profile_id,
  );
  const overdueInvoices = invoices.filter(
    (inv) =>
      inv.due_date !== null &&
      inv.due_date < todayIso &&
      Math.max(0, inv.total_amount - inv.amount_paid) > 0,
  );

  const budget = project.contract_amount ?? project.estimated_cost ?? null;
  const spent = invoices.reduce((sum, inv) => sum + Math.max(0, inv.amount_paid), 0);

  // -- Schedule risks -------------------------------------------------------

  if (overdueTasks.length >= 5) {
    risks.push({
      id: "risk_overdue_critical",
      severity: "critical",
      category: "schedule",
      message: `${overdueTasks.length} tasks are past their planned finish date.`,
    });
  } else if (overdueTasks.length >= 2) {
    risks.push({
      id: "risk_overdue_high",
      severity: "high",
      category: "schedule",
      message: `${overdueTasks.length} tasks are overdue and need attention.`,
    });
  } else if (overdueTasks.length === 1) {
    risks.push({
      id: "risk_overdue_medium",
      severity: "medium",
      category: "schedule",
      message: "1 task is past its planned finish date.",
    });
  }

  if (!project.estimated_end_date) {
    risks.push({
      id: "risk_no_target_date",
      severity: "low",
      category: "schedule",
      message: "No target completion date has been set for this project.",
    });
  }

  // -- Progress / blocked risks ---------------------------------------------

  if (blockedTasks.length >= 3) {
    risks.push({
      id: "risk_blocked_high",
      severity: "high",
      category: "progress",
      message: `${blockedTasks.length} tasks are blocked and preventing forward progress.`,
    });
  } else if (blockedTasks.length >= 1) {
    risks.push({
      id: "risk_blocked_medium",
      severity: "medium",
      category: "progress",
      message: `${blockedTasks.length} task${blockedTasks.length > 1 ? "s are" : " is"} blocked.`,
    });
  }

  if (tasks.length > 0) {
    const completedCount = tasks.filter(
      (t) => t.status.trim().toLowerCase() === "completed",
    ).length;
    const completionRatio = completedCount / tasks.length;

    if (completionRatio === 0 && tasks.length > 3) {
      risks.push({
        id: "risk_no_progress",
        severity: "medium",
        category: "progress",
        message: "No tasks have been completed yet. Verify that work has started.",
      });
    }
  }

  // -- Workforce risks -------------------------------------------------------

  if (unassignedOpenTasks.length >= 5) {
    risks.push({
      id: "risk_unassigned_high",
      severity: "high",
      category: "workforce",
      message: `${unassignedOpenTasks.length} open tasks have no assigned worker.`,
    });
  } else if (unassignedOpenTasks.length >= 2) {
    risks.push({
      id: "risk_unassigned_medium",
      severity: "medium",
      category: "workforce",
      message: `${unassignedOpenTasks.length} open tasks are missing assignees.`,
    });
  } else if (unassignedOpenTasks.length === 1) {
    risks.push({
      id: "risk_unassigned_low",
      severity: "low",
      category: "workforce",
      message: "1 open task has no assigned worker.",
    });
  }

  // -- Budget risks ----------------------------------------------------------

  if (overdueInvoices.length >= 2) {
    risks.push({
      id: "risk_invoice_overdue_high",
      severity: "high",
      category: "budget",
      message: `${overdueInvoices.length} invoices are overdue with outstanding balances.`,
    });
  } else if (overdueInvoices.length === 1) {
    risks.push({
      id: "risk_invoice_overdue_medium",
      severity: "medium",
      category: "budget",
      message: "1 invoice is overdue with an outstanding balance.",
    });
  }

  if (budget !== null && budget > 0) {
    const ratio = spent / budget;
    if (ratio > 1) {
      risks.push({
        id: "risk_over_budget",
        severity: "critical",
        category: "budget",
        message: "Recorded payments exceed the project budget baseline.",
      });
    } else if (ratio >= 0.85) {
      risks.push({
        id: "risk_near_budget",
        severity: "high",
        category: "budget",
        message: "Recorded payments are at 85% or more of the project budget.",
      });
    }
  } else if (invoices.length > 0) {
    risks.push({
      id: "risk_no_budget",
      severity: "low",
      category: "budget",
      message: "No budget baseline is set. Budget tracking is unavailable.",
    });
  }

  // -- Quality risks ---------------------------------------------------------

  const hasDescription =
    typeof project.description === "string" &&
    project.description.trim().length > 10;

  if (!hasDescription) {
    risks.push({
      id: "risk_no_description",
      severity: "low",
      category: "quality",
      message: "Project scope description is missing or incomplete.",
    });
  }

  if (counts.photos === 0 && tasks.length > 0) {
    risks.push({
      id: "risk_no_photos",
      severity: "low",
      category: "quality",
      message: "No site photos have been uploaded. Consider documenting field progress.",
    });
  }

  // -- Derive summary -------------------------------------------------------

  const highestSeverity = deriveHighestSeverity(risks);

  return {
    risks,
    highestSeverity,
    totalRisks: risks.length,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isCompletedOrCancelled(status: string) {
  const s = status.trim().toLowerCase();
  return s === "completed" || s === "cancelled";
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

const SEVERITY_ORDER: RiskSeverity[] = ["low", "medium", "high", "critical"];

function deriveHighestSeverity(risks: ProjectRisk[]): RiskSeverity | null {
  if (risks.length === 0) {
    return null;
  }

  let highest = 0;
  for (const risk of risks) {
    const index = SEVERITY_ORDER.indexOf(risk.severity);
    if (index > highest) {
      highest = index;
    }
  }

  return SEVERITY_ORDER[highest] ?? null;
}
