export type FinancialMetricSource =
  | "projects.contract_amount"
  | "projects.estimated_cost"
  | "estimates.total_amount"
  | "estimates.internal_cost_total"
  | "estimate_line_items"
  | "change_orders.total_amount"
  | "change_order_line_items.cost_amount"
  | "invoices.total_amount"
  | "invoices.amount_paid"
  | "invoice_payment_history.amount"
  | "cost_codes"
  | "purchase_orders"
  | "purchase_order_line_items"
  | "project_material_allocations"
  | "project_receipts"
  | "vendor_bills"
  | "vendor_bill_line_items"
  | "trade_partner_assignments"
  | "tasks.actual_hours"
  | "equipment"
  | "derived";

export type DataAvailability = {
  key: string;
  label: string;
  status: "available" | "partial" | "unavailable";
  detail: string;
};

export type ProjectFinancialSummary = {
  projectId: string;
  projectName: string;
  originalEstimate: number;
  approvedChangeOrders: number;
  revisedContractValue: number;
  originalBudget: number;
  revisedBudget: number;
  committedCost: number;
  actualCost: number;
  remainingCostToComplete: number;
  forecastFinalCost: number;
  grossProfit: number;
  grossMarginPercent: number | null;
  amountInvoiced: number;
  paymentsReceived: number;
  outstandingReceivables: number;
  retainage: number;
  unbilledContractValue: number;
  metricSources: Record<string, FinancialMetricSource[]>;
};

export type JobCostCategoryKey = "labor" | "materials" | "equipment" | "vendors" | "other";

export type JobCostCategoryRow = {
  category: JobCostCategoryKey;
  budget: number;
  committed: number;
  actual: number;
  forecast: number;
  varianceAmount: number;
  variancePercent: number | null;
  status: "on_track" | "at_risk" | "over_budget" | "unavailable";
  dataStatus: "measured" | "partial" | "unavailable";
  note: string | null;
};

export type CostCodeVarianceRow = {
  costCodeId: string;
  code: string;
  name: string;
  budget: number;
  committed: number;
  actual: number;
  forecast: number;
  varianceAmount: number;
  variancePercent: number | null;
  status: "on_track" | "at_risk" | "over_budget";
};

export type LaborCostSnapshot = {
  employeeHours: number | null;
  crewHours: number | null;
  regularLaborCost: number | null;
  overtimeCost: number | null;
  totalLaborCost: number | null;
  source: FinancialMetricSource[];
  note: string;
};

export type MaterialCostSnapshot = {
  requestCount: number;
  purchaseOrderCount: number;
  committedMaterialCost: number;
  actualMaterialCost: number;
  outstandingMaterialCommitments: number;
  source: FinancialMetricSource[];
};

export type EquipmentCostSnapshot = {
  assignedEquipmentCount: number;
  usageCost: number | null;
  rentalCost: number | null;
  maintenanceCost: number | null;
  source: FinancialMetricSource[];
  note: string;
};

export type VendorCostSnapshot = {
  activeVendorAssignments: number;
  committedVendorCost: number;
  actualVendorCost: number | null;
  source: FinancialMetricSource[];
  note: string;
};

export type BillingSnapshot = {
  draftInvoices: number;
  sentInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  totalInvoiced: number;
  totalCollected: number;
  outstandingBalance: number;
  retainage: number;
  unbilledContractAmount: number;
  source: FinancialMetricSource[];
};

export type AccountsPayableJobCostSnapshot = {
  approvedBillCost: number;
  paidBillCost: number;
  outstandingApprovedCost: number;
  billCount: number;
  matchedBillCount: number;
  needsReviewBillCount: number;
  source: FinancialMetricSource[];
};

export type ProjectFinancialReport = {
  summary: ProjectFinancialSummary;
  jobCostByCategory: JobCostCategoryRow[];
  costCodeVariance: CostCodeVarianceRow[];
  labor: LaborCostSnapshot;
  materials: MaterialCostSnapshot;
  equipment: EquipmentCostSnapshot;
  vendors: VendorCostSnapshot;
  billing: BillingSnapshot;
  accountsPayable?: AccountsPayableJobCostSnapshot;
  availability: DataAvailability[];
};

export type CompanyFinancialSummary = {
  companyRevenue: number;
  totalBacklog: number;
  totalOutstandingReceivables: number;
  committedCost: number;
  projectGrossProfit: number;
  projectMarginPercent: number | null;
  jobsOverBudget: number;
  jobsUnderMarginTarget: number;
  cashExposure: number;
  source: FinancialMetricSource[];
};

export type CompanyFinancialReport = {
  summary: CompanyFinancialSummary;
  projectsReviewed: number;
  marginTargetPercent: number;
  availability: DataAvailability[];
};
