import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const portal = read("app/(app)/partner/[projectId]/page.tsx");
const index = read("app/(app)/partner/page.tsx");
const migration = read("supabase/migrations/20260815174500_trade_partner_portal_channels.sql");
const hardening = read("supabase/migrations/20260815175500_trade_partner_portal_channel_hardening.sql");

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
  ["trade partner plan records are read-only", hardening.includes("blueprint_versions_update_guard") && hardening.includes("blueprint_versions_delete_guard")],
  ["trade partner plan objects are read-only", hardening.includes("blueprint_storage_update_guard") && hardening.includes("blueprint_storage_delete_guard")],
  ["partner photo object mutation is owner scoped", hardening.includes("pp.uploaded_by = auth.uid()")],
  ["message table is project and vendor scoped", migration.includes("create table if not exists public.trade_partner_messages") && migration.includes("vendor_id uuid not null")],
  ["message body is bounded", migration.includes("between 1 and 4000")],
  ["financial terms are absent from channel RPC return contracts", !migration.includes("contract_amount") && !migration.includes("profit") && !migration.includes("markup")],
];

let failed = 0;
for (const [label, pass] of checks) {
  if (pass) console.log(`  + ${label}`);
  else { failed += 1; console.error(`  - ${label}`); }
}

console.log(`\nTrade partner portal contract results: ${checks.length - failed} passed, ${failed} failed`);
if (failed) process.exit(1);
