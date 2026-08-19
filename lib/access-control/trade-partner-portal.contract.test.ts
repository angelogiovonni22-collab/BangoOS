import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const portal = read("app/(app)/partner/[projectId]/page.tsx");
const index = read("app/(app)/partner/page.tsx");
const inbox = read("app/(app)/trade-partner-messages/page.tsx");
const shell = read("app/(app)/app-shell.tsx");
const permissions = read("lib/access-control/permissions.ts");
const projectLifecycleApi = read("app/api/projects/[id]/lifecycle/route.ts");
const subcontractAgreementApi = read("app/api/projects/[id]/subcontractors/[assignmentId]/agreement/route.ts");
const subcontractMobilizationApi = read("app/api/projects/[id]/subcontractors/[assignmentId]/mobilization/route.ts");
const subcontractComplianceApi = read("app/api/projects/[id]/subcontractors/[assignmentId]/compliance-documents/route.ts");
const migration = read("supabase/migrations/20260815174500_trade_partner_portal_channels.sql");
const hardening = read("supabase/migrations/20260815175500_trade_partner_portal_channel_hardening.sql");
const internalMessaging = read("supabase/migrations/20260815180500_trade_partner_internal_messaging.sql");
const externalIsolation = read("supabase/migrations/20260819011500_external_portal_rls_hardening.sql");
const rpcHardening = read("supabase/migrations/20260819013000_privileged_rpc_authorization_hardening.sql");

const checks: Array<[string, boolean]> = [
  ["assigned jobs link into a project-scoped trade partner workspace", index.includes("/partner/${job.project_id}")],
  ["portal loads sanitized photo RPC", portal.includes('rpc("get_my_trade_partner_photos"')],
  ["portal loads latest approved plan RPC", portal.includes('rpc("get_my_trade_partner_plans"')],
  ["portal loads project messages RPC", portal.includes('rpc("get_my_trade_partner_messages"')],
  ["portal sends messages through controlled RPC", portal.includes('rpc("send_my_trade_partner_message"')],
  ["portal registers partner photos through controlled RPC", portal.includes('rpc("register_my_trade_partner_photo"')],
  ["photo upload is capped at 10MB", portal.includes("10 * 1024 * 1024")],
  ["partner project access derives from linked vendor assignment", migration.includes("bos_can_access_trade_partner_project") && migration.includes("tpa.vendor_id = cm.vendor_id")],
  ["receipts are excluded from partner-safe photos", migration.includes("'before','progress','after','safety','damage','materials','inspection','other'") && !migration.includes("pp.category in ('before','progress','after','safety','damage','materials','receipt")],
  ["trade partner plans require approved status", migration.includes("bv.status = 'approved'")],
  ["blueprint storage is assignment scoped", migration.includes("bos_trade_partner_blueprint_storage_select_guard") && migration.includes("public.bos_can_access_trade_partner_project(bv.project_id)")],
  ["trade partner plan records are read-only", hardening.includes("array['blueprint_sets','blueprint_sheets','blueprint_versions']") && hardening.includes("'bos_trade_partner_' || t || '_update_guard'") && hardening.includes("'bos_trade_partner_' || t || '_delete_guard'")],
  ["trade partner plan objects are read-only", hardening.includes("blueprint_storage_update_guard") && hardening.includes("blueprint_storage_delete_guard")],
  ["partner photo object mutation is owner scoped", hardening.includes("pp.uploaded_by = auth.uid()")],
  ["message table is project and vendor scoped", migration.includes("create table if not exists public.trade_partner_messages") && migration.includes("vendor_id uuid not null")],
  ["message body is bounded", migration.includes("between 1 and 4000") && internalMessaging.includes("between 1 and 4000")],
  ["internal B.O.S. inbox is wired into navigation", shell.includes("/trade-partner-messages") && shell.includes("Trade Partner Messages")],
  ["internal inbox is permission-gated", permissions.includes('{ prefix: "/trade-partner-messages", permission: "communications.view" }') && inbox.includes('hasBosPermission(workspace.context.role, "communications.view")')],
  ["internal inbox loads controlled thread and message RPCs", inbox.includes('rpc("get_trade_partner_message_threads"') && inbox.includes('rpc("get_trade_partner_messages_for_assignment"')],
  ["internal replies use controlled manage-permission RPC", inbox.includes('rpc("send_trade_partner_message_for_assignment"') && internalMessaging.includes("communications.manage")],
  ["internal message RPCs stay assignment/project/vendor scoped", internalMessaging.includes("v_assignment.project_id") && internalMessaging.includes("v_assignment.vendor_id")],
  ["external roles cannot use the internal message RPCs", rpcHardening.includes("not public.bos_is_external_company_user(tpa.company_id)") && rpcHardening.includes("or public.bos_is_external_company_user(v_assignment.company_id)") && inbox.includes('["subcontractor", "customer"]')],
  ["financial terms are absent from partner channel RPC return contracts", !migration.includes("contract_amount") && !migration.includes("profit") && !migration.includes("markup") && !internalMessaging.includes("contract_amount")],
  ["external company accounts are detected at the database boundary", externalIsolation.includes("create or replace function public.bos_is_external_company_user") && externalIsolation.includes("lower(cm.role) in ('subcontractor','customer')")],
  ["company-scoped RLS tables default-deny external portal accounts", externalIsolation.includes("bos_external_portal_isolation_guard") && externalIsolation.includes("as restrictive for all to authenticated") && externalIsolation.includes("not public.bos_is_external_company_user(company_id)")],
  ["workspace identity and explicitly scoped partner channels are the only table exceptions", externalIsolation.includes("'profiles'") && externalIsolation.includes("'company_memberships'") && externalIsolation.includes("'project_photos'") && externalIsolation.includes("'blueprint_versions'") && externalIsolation.includes("'trade_partner_messages'")],
  ["customers cannot inherit partner photo plan or message channels", externalIsolation.includes("bos_customer_portal_channel_guard") && externalIsolation.includes("not public.bos_is_customer_for_company(company_id)")],
  ["portal-only storage is limited to partner-safe buckets", externalIsolation.includes("bos_external_portal_storage_select_guard") && externalIsolation.includes("bucket_id in ('project-photos','blueprints')")],
  ["portal-only storage writes are limited to project photos", externalIsolation.includes("bos_external_portal_storage_insert_guard") && externalIsolation.includes("bucket_id = 'project-photos'")],
  ["customer portal has no direct storage channel", externalIsolation.includes("create or replace function public.bos_is_portal_only_user") && externalIsolation.includes("lower(cm.role) = 'subcontractor'")],
  ["project lifecycle API requires project-management permission before mutation", projectLifecycleApi.includes('hasBosPermission(workspace.context.role, "projects.manage")')],
  ["subcontract agreement admin API requires project-management permission", subcontractAgreementApi.includes('hasBosPermission(workspace.context.role, "projects.manage")')],
  ["subcontract mobilization admin API requires project-management permission", subcontractMobilizationApi.includes('hasBosPermission(workspace.context.role, "projects.manage")')],
  ["subcontract compliance admin API requires project-management permission", subcontractComplianceApi.includes('hasBosPermission(workspace.context.role, "projects.manage")')],
  ["project numbering RPC requires projects.manage", rpcHardening.includes("bos_role_has_permission(p_company_id, 'projects.manage')")],
  ["estimate numbering RPC requires estimates.manage", rpcHardening.includes("bos_role_has_permission(p_company_id, 'estimates.manage')")],
  ["change-order numbering RPC requires change_orders.manage", rpcHardening.includes("bos_role_has_permission(p_company_id, 'change_orders.manage')")],
  ["estimate conversion RPC is wrapped behind estimates.manage", rpcHardening.includes("bos_legacy_convert_estimate_to_project_impl") && rpcHardening.includes("Estimate conversion access denied")],
  ["estimate deposit RPC is wrapped behind estimates.view", rpcHardening.includes("bos_legacy_calculate_estimate_deposit_impl") && rpcHardening.includes("Estimate deposit access denied")],
  ["project delete and restore RPCs require projects.manage", rpcHardening.includes("bos_legacy_soft_delete_project_impl") && rpcHardening.includes("bos_legacy_restore_deleted_project_impl") && rpcHardening.includes("Project lifecycle access denied")],
  ["blueprint privileged RPCs require blueprints.manage", rpcHardening.includes("bos_legacy_create_blueprint_sheet_upload_impl") && rpcHardening.includes("bos_legacy_register_blueprint_revision_impl") && rpcHardening.includes("Blueprint management access denied")],
  ["mobilization refresh is service-role only", rpcHardening.includes("revoke execute on function public.refresh_subcontractor_mobilization_status(uuid,uuid) from public, anon, authenticated") && rpcHardening.includes("grant execute on function public.refresh_subcontractor_mobilization_status(uuid,uuid) to service_role")],
  ["portal identity RPCs are no longer anonymous", rpcHardening.includes("revoke execute on function public.get_my_trade_partner_jobs() from public, anon") && rpcHardening.includes("revoke execute on function public.get_my_customer_projects() from public, anon")],
];

let failed = 0;
for (const [label, pass] of checks) {
  if (pass) console.log(`  + ${label}`);
  else { failed += 1; console.error(`  - ${label}`); }
}

console.log(`\nTrade partner portal contract results: ${checks.length - failed} passed, ${failed} failed`);
if (failed) process.exit(1);
