export type AIContext = {
  userId: string;
  companyId: string;
  customerId?: string | null;
  projectId?: string | null;
  route: string;
  userRole: string | null;
};

export type AIActionName =
  | "summarize_project"
  | "create_project_draft"
  | "create_estimate_draft"
  | "create_invoice_draft"
  | "summarize_daily_logs"
  | "identify_project_risks"
  | "list_overdue_items";

export type AIPermissionLevel = "read" | "draft" | "execute_with_confirmation";

export type AIAuditStatus = "queued" | "completed" | "failed" | "cancelled";

export type AIAuditEvent = {
  id: string;
  company_id: string;
  user_id: string;
  action: AIActionName;
  status: AIAuditStatus;
  input_summary: string;
  output_summary: string;
  created_at: string;
};

export type AIActionDefinition = {
  name: AIActionName;
  permission: AIPermissionLevel;
  description: string;
};

export type AIActionRegistry = Record<AIActionName, AIActionDefinition>;

export type AICurrentRoute = string;