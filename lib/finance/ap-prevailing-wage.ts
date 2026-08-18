import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type UntypedQueryBuilder = {
  select: (columns: string) => UntypedQueryBuilder;
  eq: (column: string, value: unknown) => UntypedQueryBuilder;
  neq: (column: string, value: unknown) => UntypedQueryBuilder;
  in: (column: string, values: unknown[]) => UntypedQueryBuilder;
  maybeSingle: () => Promise<{ data: unknown; error: { message?: string } | null }>;
  then: PromiseLike<{ data: unknown; error: { message?: string } | null }>["then"];
};

type UntypedClient = {
  from: (table: string) => UntypedQueryBuilder;
};

export type AccountsPayableSnapshot = {
  totalOpenBills: number;
  totalApproved: number;
  totalPaid: number;
  totalOutstanding: number;
  overdueOutstanding: number;
  billCount: number;
  overdueBillCount: number;
};

export type PrevailingWageComplianceResult = {
  requiredBaseHourly: number;
  requiredFringeHourly: number;
  requiredCombinedHourly: number;
  actualBaseHourly: number;
  actualCashFringeHourly: number;
  actualBonaFideFringeHourly: number;
  actualCombinedHourly: number;
  hourlyDeficiency: number;
  regularHours: number;
  overtimeHours: number;
  estimatedDeficiencyAmount: number;
  compliant: boolean;
};

type AccountsPayableRow = {
  status: string | null;
  total_amount: number | null;
  amount_paid: number | null;
  balance_due: number | null;
  due_date: string | null;
};

type PrevailingWageProfileRow = {
  id: string;
  applicability: string;
  jurisdiction: string;
  certified_payroll_required: boolean;
  wage_posting_required: boolean;
  completion_affidavit_required: boolean;
};

type PrevailingWageTimeRow = {
  id: string;
  worker_assignment_id: string;
  regular_hours: number;
  overtime_hours: number;
  actual_base_rate: number;
  actual_cash_fringe: number;
  actual_bona_fide_fringe: number;
};

type PrevailingWageAssignmentRow = {
  id: string;
  classification_id: string;
};

type PrevailingWageClassificationRow = {
  id: string;
  classification_name: string | null;
  base_hourly_rate: number;
  fringe_hourly_rate: number;
  overtime_multiplier: number;
};

function asUntypedClient(client: SupabaseClient<Database>): UntypedClient {
  return client as unknown as UntypedClient;
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function safe(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function rowsOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function calculatePrevailingWageCompliance(input: {
  requiredBaseHourly: number;
  requiredFringeHourly: number;
  overtimeMultiplier?: number;
  actualBaseHourly: number;
  actualCashFringeHourly?: number;
  actualBonaFideFringeHourly?: number;
  regularHours: number;
  overtimeHours?: number;
}): PrevailingWageComplianceResult {
  const requiredBaseHourly = Math.max(0, safe(input.requiredBaseHourly));
  const requiredFringeHourly = Math.max(0, safe(input.requiredFringeHourly));
  const actualBaseHourly = Math.max(0, safe(input.actualBaseHourly));
  const actualCashFringeHourly = Math.max(0, safe(input.actualCashFringeHourly));
  const actualBonaFideFringeHourly = Math.max(0, safe(input.actualBonaFideFringeHourly));
  const regularHours = Math.max(0, safe(input.regularHours));
  const overtimeHours = Math.max(0, safe(input.overtimeHours));
  const overtimeMultiplier = Math.max(1, safe(input.overtimeMultiplier) || 1.5);

  const requiredCombinedHourly = requiredBaseHourly + requiredFringeHourly;
  const actualCombinedHourly = actualBaseHourly + actualCashFringeHourly + actualBonaFideFringeHourly;
  const hourlyDeficiency = Math.max(0, requiredCombinedHourly - actualCombinedHourly);

  const regularDeficiency = hourlyDeficiency * regularHours;
  const requiredOvertimeCombined = (requiredBaseHourly * overtimeMultiplier) + requiredFringeHourly;
  const actualOvertimeCombined = (actualBaseHourly * overtimeMultiplier) + actualCashFringeHourly + actualBonaFideFringeHourly;
  const overtimeDeficiency = Math.max(0, requiredOvertimeCombined - actualOvertimeCombined) * overtimeHours;

  return {
    requiredBaseHourly: money(requiredBaseHourly),
    requiredFringeHourly: money(requiredFringeHourly),
    requiredCombinedHourly: money(requiredCombinedHourly),
    actualBaseHourly: money(actualBaseHourly),
    actualCashFringeHourly: money(actualCashFringeHourly),
    actualBonaFideFringeHourly: money(actualBonaFideFringeHourly),
    actualCombinedHourly: money(actualCombinedHourly),
    hourlyDeficiency: money(hourlyDeficiency),
    regularHours,
    overtimeHours,
    estimatedDeficiencyAmount: money(regularDeficiency + overtimeDeficiency),
    compliant: hourlyDeficiency <= 0.0001 && overtimeDeficiency <= 0.0001,
  };
}

export async function loadAccountsPayableSnapshot(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  projectId?: string | null;
}): Promise<AccountsPayableSnapshot> {
  const db = asUntypedClient(params.supabase);
  let query = db
    .from("vendor_bills")
    .select("status, total_amount, amount_paid, balance_due, due_date")
    .eq("company_id", params.companyId)
    .neq("status", "voided");

  if (params.projectId) {
    query = query.eq("project_id", params.projectId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || "Unable to load accounts payable.");
  }

  const rows = rowsOf<AccountsPayableRow>(data);
  const today = new Date().toISOString().slice(0, 10);
  let totalOpenBills = 0;
  let totalApproved = 0;
  let totalPaid = 0;
  let totalOutstanding = 0;
  let overdueOutstanding = 0;
  let overdueBillCount = 0;

  for (const row of rows) {
    const total = safe(row.total_amount);
    const paid = safe(row.amount_paid);
    const balance = safe(row.balance_due);
    const status = String(row.status || "");

    if (balance > 0) {
      totalOpenBills += total;
      totalOutstanding += balance;
    }
    if (["approved", "partially_paid", "paid"].includes(status)) {
      totalApproved += total;
    }
    totalPaid += paid;

    if (balance > 0 && row.due_date && row.due_date < today) {
      overdueOutstanding += balance;
      overdueBillCount += 1;
    }
  }

  return {
    totalOpenBills: money(totalOpenBills),
    totalApproved: money(totalApproved),
    totalPaid: money(totalPaid),
    totalOutstanding: money(totalOutstanding),
    overdueOutstanding: money(overdueOutstanding),
    billCount: rows.length,
    overdueBillCount,
  };
}

export async function loadPrevailingWageProjectCompliance(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  projectId: string;
}) {
  const db = asUntypedClient(params.supabase);

  const { data: profileData, error: profileError } = await db
    .from("prevailing_wage_project_profiles")
    .select("id, applicability, jurisdiction, certified_payroll_required, wage_posting_required, completion_affidavit_required")
    .eq("company_id", params.companyId)
    .eq("project_id", params.projectId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message || "Unable to load prevailing wage profile.");
  }

  const profile = profileData as PrevailingWageProfileRow | null;
  if (!profile || profile.applicability === "not_applicable") {
    return {
      applicable: false,
      profile: profile || null,
      workerRows: [],
      totalEstimatedDeficiency: 0,
      compliantWorkerCount: 0,
      deficientWorkerCount: 0,
    };
  }

  const { data: rowData, error: rowsError } = await db
    .from("prevailing_wage_time_entries")
    .select("id, worker_assignment_id, regular_hours, overtime_hours, actual_base_rate, actual_cash_fringe, actual_bona_fide_fringe")
    .eq("company_id", params.companyId)
    .eq("project_id", params.projectId);

  if (rowsError) {
    throw new Error(rowsError.message || "Unable to load prevailing wage time entries.");
  }

  const rows = rowsOf<PrevailingWageTimeRow>(rowData);
  const assignmentIds = [...new Set(rows.map((row) => row.worker_assignment_id))];
  const assignmentResult = assignmentIds.length > 0
    ? await db
      .from("prevailing_wage_worker_assignments")
      .select("id, classification_id")
      .eq("company_id", params.companyId)
      .in("id", assignmentIds)
    : { data: [], error: null };

  if (assignmentResult.error) {
    throw new Error(assignmentResult.error.message || "Unable to load prevailing wage assignments.");
  }

  const assignments = rowsOf<PrevailingWageAssignmentRow>(assignmentResult.data);
  const classificationIds = [...new Set(assignments.map((row) => row.classification_id))];
  const classificationResult = classificationIds.length > 0
    ? await db
      .from("prevailing_wage_classifications")
      .select("id, classification_name, base_hourly_rate, fringe_hourly_rate, overtime_multiplier")
      .eq("company_id", params.companyId)
      .in("id", classificationIds)
    : { data: [], error: null };

  if (classificationResult.error) {
    throw new Error(classificationResult.error.message || "Unable to load prevailing wage classifications.");
  }

  const classifications = rowsOf<PrevailingWageClassificationRow>(classificationResult.data);
  const assignmentMap = new Map(assignments.map((row) => [row.id, row]));
  const classificationMap = new Map(classifications.map((row) => [row.id, row]));

  const workerRows = rows.map((row) => {
    const assignment = assignmentMap.get(row.worker_assignment_id);
    const classification = assignment ? classificationMap.get(assignment.classification_id) : null;

    if (!classification) {
      return {
        timeEntryId: row.id,
        workerAssignmentId: row.worker_assignment_id,
        classificationName: "Unknown",
        missingClassification: true,
        compliance: null,
      };
    }

    return {
      timeEntryId: row.id,
      workerAssignmentId: row.worker_assignment_id,
      classificationName: String(classification.classification_name || "Classification"),
      missingClassification: false,
      compliance: calculatePrevailingWageCompliance({
        requiredBaseHourly: safe(classification.base_hourly_rate),
        requiredFringeHourly: safe(classification.fringe_hourly_rate),
        overtimeMultiplier: safe(classification.overtime_multiplier) || 1.5,
        actualBaseHourly: safe(row.actual_base_rate),
        actualCashFringeHourly: safe(row.actual_cash_fringe),
        actualBonaFideFringeHourly: safe(row.actual_bona_fide_fringe),
        regularHours: safe(row.regular_hours),
        overtimeHours: safe(row.overtime_hours),
      }),
    };
  });

  const totalEstimatedDeficiency = workerRows.reduce((sum, row) => sum + (row.compliance?.estimatedDeficiencyAmount || 0), 0);
  const workerState = new Map<string, "compliant" | "deficient">();
  for (const row of workerRows) {
    const deficient = row.missingClassification || Boolean(row.compliance && !row.compliance.compliant);
    const current = workerState.get(row.workerAssignmentId);
    if (deficient) {
      workerState.set(row.workerAssignmentId, "deficient");
    } else if (!current) {
      workerState.set(row.workerAssignmentId, "compliant");
    }
  }
  const deficientWorkerCount = [...workerState.values()].filter((state) => state === "deficient").length;
  const compliantWorkerCount = [...workerState.values()].filter((state) => state === "compliant").length;

  return {
    applicable: true,
    profile,
    workerRows,
    totalEstimatedDeficiency: money(totalEstimatedDeficiency),
    compliantWorkerCount,
    deficientWorkerCount,
  };
}
