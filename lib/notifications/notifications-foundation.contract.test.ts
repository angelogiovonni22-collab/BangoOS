import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
const migration = read("supabase/migrations/20260823020000_centralized_notifications_inbox.sql");
const indexMigration = read("supabase/migrations/20260823023000_notifications_foreign_key_indexes.sql");
const route = read("app/api/notifications/route.ts");
const center = read("components/notifications/notification-center.tsx");
const inbox = read("app/(app)/notifications/page.tsx");
const shell = read("app/(app)/app-shell.tsx");

assert.match(migration, /create table if not exists public\.bos_notifications/);
assert.match(migration, /recipient_user_id = \(select auth\.uid\(\)\)/);
assert.match(migration, /with check/);
assert.match(migration, /delivery_state text not null/);
assert.match(migration, /in_app_status text not null/);
assert.match(migration, /push_status text not null/);
assert.match(migration, /email_status text not null/);
assert.match(migration, /alter publication supabase_realtime add table public\.bos_notifications/);
assert.match(migration, /insert into public\.bos_notifications/);
assert.match(migration, /source_key/);
assert.doesNotMatch(migration, /grant .*bos_notifications to anon/);
assert.match(indexMigration, /bos_notifications_recipient_user_idx/);
assert.match(indexMigration, /bos_notifications_actor_user_idx/);
assert.match(route, /recipient_user_id", workspace\.context\.userId/);
assert.match(route, /mark_all_read/);
assert.match(route, /requestedChannels/);
assert.match(center, /postgres_changes/);
assert.match(center, /Open notification inbox/);
assert.match(inbox, /Notification Inbox/);
assert.match(inbox, /Archive/);
assert.match(shell, /<NotificationCenter \/>/);

console.log("Centralized notifications service and inbox contract passed.");
