import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const migration = readFileSync(resolve(root, "supabase/migrations/20260813130000_blueprint_operational_links.sql"), "utf8");
const service = readFileSync(resolve(root, "lib/blueprints/operations.ts"), "utf8");
const surface = readFileSync(resolve(root, "components/plans/blueprint-markup-surface.tsx"), "utf8");

assert.match(migration, /enable row level security/i);
assert.match(migration, /is_company_member\(company_id\)/);
assert.match(migration, /created_by = auth\.uid\(\)/);
assert.match(migration, /create_task_from_blueprint_issue/);
assert.match(migration, /annotation_type = 'pin'/);
assert.match(migration, /pg_advisory_xact_lock/);
assert.match(migration, /unique \(company_id, annotation_id, target_type, target_id\)/);
assert.match(service, /\.eq\("company_id", identity\.companyId\)/);
assert.match(service, /\.eq\("project_id", identity\.projectId\)/);
assert.match(service, /\.eq\("blueprint_version_id", identity\.versionId\)/);
assert.match(surface, /Create task/);
assert.match(surface, /Task linked/);

console.log("Blueprint operational integration contract checks passed.");
