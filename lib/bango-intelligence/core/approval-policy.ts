import type {
  ApprovalLevel,
  BangoCapabilityId,
  BangoRoleDefinition,
} from "./context-types";

export const BASE_CAPABILITY_APPROVAL_POLICY: Record<BangoCapabilityId, ApprovalLevel> = {
  read_project: "none_required",
  read_tasks: "none_required",
  read_schedule: "none_required",
  read_financials: "manager_approval",
  read_employees: "manager_approval",
  read_documents: "none_required",
  read_safety_records: "manager_approval",
  read_purchasing: "manager_approval",
  read_customers: "none_required",
  recommend_task_priority: "none_required",
  recommend_schedule_change: "manager_approval",
  recommend_crew_assignment: "manager_approval",
  recommend_estimate_adjustment: "manager_approval",
  recommend_purchase: "manager_approval",
  recommend_collection_action: "user_confirmation",
  recommend_safety_review: "qualified_professional_approval",
  draft_daily_report: "user_confirmation",
  draft_customer_message: "user_confirmation",
  draft_vendor_message: "user_confirmation",
  draft_change_order: "manager_approval",
  draft_estimate_scope: "manager_approval",
  update_task: "manager_approval",
  update_schedule: "manager_approval",
  send_message: "user_confirmation",
  approve_change_order: "owner_approval",
  create_purchase_order: "manager_approval",
  pay_invoice: "owner_approval",
  modify_payroll: "owner_approval",
  terminate_employee: "prohibited",
};

export function getApprovalLevelForCapability(
  role: BangoRoleDefinition,
  capability: BangoCapabilityId,
): ApprovalLevel {
  if (role.deniedCapabilities.includes(capability)) {
    return "prohibited";
  }

  return role.approvalPolicy.capabilityOverrides[capability]
    ?? BASE_CAPABILITY_APPROVAL_POLICY[capability]
    ?? role.approvalPolicy.defaultLevel;
}
