import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const projectPage = fs.readFileSync(path.join(root, "app/(app)/projects/[id]/page.tsx"), "utf8");
const messaging = fs.readFileSync(path.join(root, "components/projects/workspace/project-trade-partner-messages.tsx"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260820120000_project_trade_partner_manager_notifications.sql"), "utf8");

assert.match(projectPage, /ProjectTradePartnerMessages/);
assert.match(projectPage, /communications\.manage/);
assert.ok(
  projectPage.indexOf("<ProjectTradePartnerMessages") < projectPage.indexOf("<ProjectTradePartnersWorkspace"),
  "project messaging renders before subcontractor management so it is visible when the tab opens",
);
assert.match(messaging, /get_trade_partner_message_threads/);
assert.match(messaging, /get_trade_partner_messages_for_assignment/);
assert.match(messaging, /send_trade_partner_message_for_assignment/);
assert.match(migration, /new\.sender_type <> 'trade_partner'/);
assert.match(migration, /p\.created_by/);
assert.match(migration, /insert into public\.orion_reminders/);
assert.match(migration, /\?tab=subcontractors/);

console.log("project trade partner messaging contract passed");
