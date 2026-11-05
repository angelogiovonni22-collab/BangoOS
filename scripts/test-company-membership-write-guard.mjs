// Isolated PostgreSQL authorization regression; never reads production credentials.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const files = (await readdir("supabase/migrations")).filter((name) => name.endsWith("_company_membership_write_guard.sql"));
assert.equal(files.length, 1, "one membership guard migration is expected");
const migration = await readFile("supabase/migrations/" + files[0], "utf8");
const foundation = await readFile("supabase/migrations/20260729170000_multi_company_foundation.sql", "utf8");
const roleHelper = foundation.match(/create or replace function public\.has_company_role\([\s\S]*?\$\$;/i)?.[0];
const profileSync = foundation.match(/create or replace function public\.trg_company_memberships_sync_profiles_fn\(\)[\s\S]*?\$\$;/i)?.[0];
assert.ok(roleHelper && profileSync, "reuse the production ownership and profile synchronization functions");
const db = new PGlite();
const A = "00000000-0000-4000-8000-000000000001", B = "00000000-0000-4000-8000-000000000002", C = "00000000-0000-4000-8000-000000000003";
const owner = "00000000-0000-4000-8000-000000000101", employee = "00000000-0000-4000-8000-000000000102", inactive = "00000000-0000-4000-8000-000000000103", admin = "00000000-0000-4000-8000-000000000104", newcomer = "00000000-0000-4000-8000-000000000105", invited = "00000000-0000-4000-8000-000000000106", leaver = "00000000-0000-4000-8000-000000000107";
let checks = 0;
const q = async (sql, values = []) => (await db.query(sql, values)).rows;
const as = async (user, role = "authenticated") => {
  await db.exec("reset role; set role " + role);
  await q("select set_config('request.jwt.claim.sub', $1, false)", [user || ""]);
};
const root = async () => db.exec("reset role");
const denied = async (sql, label) => {
  await assert.rejects(db.exec(sql), (error) => error.code === "42501", label);
  checks += 1;
};
try {
  await db.exec(`
    create role authenticated; create role anon; create role service_role bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.companies(id uuid primary key, owner_id uuid not null);
    create table public.profiles(id uuid primary key, company_id uuid, role text, updated_at timestamptz);
    create table public.company_memberships(
      id uuid primary key default gen_random_uuid(), company_id uuid not null references companies(id), user_id uuid not null,
      role text not null default 'employee', status text not null default 'active', is_primary boolean not null default false,
      joined_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      department text, vendor_id uuid, customer_id uuid, permission_overrides jsonb not null default '{}'::jsonb,
      unique(company_id,user_id));
    create function public.company_role_weight(text) returns integer language sql as $$ select case when $1='owner' then 10 when $1='administrator' then 9 else 0 end $$;
    insert into companies values ('${A}','${owner}'),('${B}','00000000-0000-4000-8000-000000000199'),('${C}','${newcomer}');
    insert into profiles(id,role) values ('${owner}','owner'),('${employee}','employee'),('${inactive}','employee'),('${admin}','administrator'),('${newcomer}','owner'),('${invited}','employee'),('${leaver}','employee');
  `);
  await db.exec(roleHelper + "\n" + profileSync);
  await db.exec(`
    create trigger membership_sync after insert or update or delete on company_memberships for each row execute function trg_company_memberships_sync_profiles_fn();
    alter table company_memberships enable row level security;
    grant usage on schema auth, public to authenticated, anon, service_role;
    grant all on companies, profiles, company_memberships to service_role;
    grant select on companies to authenticated;
    grant select, insert, update, delete on company_memberships to authenticated;
    grant insert on company_memberships to anon;
    create policy membership_read on company_memberships for select to authenticated using(user_id=auth.uid() or public.has_company_role(company_id,array['owner','administrator'],auth.uid()));
    create policy company_memberships_insert_own on company_memberships for insert to authenticated with check(user_id=auth.uid());
    create policy company_memberships_update_own on company_memberships for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
    create policy membership_insert_admin on company_memberships for insert to authenticated with check(public.has_company_role(company_id,array['owner','administrator'],auth.uid()));
    create policy membership_update_admin on company_memberships for update to authenticated using(public.has_company_role(company_id,array['owner','administrator'],auth.uid())) with check(public.has_company_role(company_id,array['owner','administrator'],auth.uid()));
    create policy membership_delete_own on company_memberships for delete to authenticated using(user_id=auth.uid());
    insert into company_memberships(company_id,user_id,role,status,is_primary) values
      ('${A}','${owner}','owner','active',true),('${A}','${employee}','employee','active',true),
      ('${A}','${inactive}','employee','inactive',false),('${B}','${admin}','administrator','active',true),
      ('${A}','${leaver}','employee','active',true);
  `);
  await as(employee);
  await db.exec(`update company_memberships set role='owner' where user_id='${employee}' and company_id='${A}'`);
  assert.equal((await q(`select role from company_memberships where user_id='${employee}'`))[0].role, "owner", "legacy own-row policy permits the escalation before the guard");
  checks += 1;
  await root();
  await db.exec(`update company_memberships set role='employee' where user_id='${employee}' and company_id='${A}'`);
  await db.exec(migration);
  await as(employee);
  await denied(`update company_memberships set role='owner' where user_id='${employee}'`, "employee cannot promote their role");
  await denied(`update company_memberships set permission_overrides='{"payroll.process":true}' where user_id='${employee}'`, "employee cannot grant themselves permission overrides");
  await denied(`update company_memberships set company_id='${B}' where user_id='${employee}'`, "employee cannot move a membership to another company");
  await denied(`update company_memberships set user_id='${invited}' where user_id='${employee}'`, "employee cannot change membership identity");
  await denied(`update company_memberships set vendor_id='${invited}' where user_id='${employee}'`, "employee cannot relink vendor access");
  await denied(`update company_memberships set customer_id='${invited}' where user_id='${employee}'`, "employee cannot relink customer access");
  await denied(`insert into company_memberships(company_id,user_id,role) values('${B}','${employee}','employee')`, "employee cannot self-join another company");
  await denied(`insert into company_memberships(company_id,user_id,role) values('${B}','${employee}','owner')`, "employee cannot self-join another company as owner");
  await db.exec(`update company_memberships set is_primary=false where user_id='${employee}'`);
  assert.equal((await q(`select is_primary from company_memberships where user_id='${employee}'`))[0].is_primary, false, "own primary-workspace update remains available");
  checks += 1;
  await as(inactive);
  await denied(`update company_memberships set status='active' where user_id='${inactive}'`, "inactive member cannot reactivate themselves");
  await root();
  assert.equal((await q(`select company_id from profiles where id='${inactive}'`))[0].company_id, null, "inactive profile remains detached");
  checks += 1;
  await as(owner);
  await db.exec(`update company_memberships set role='foreman' where user_id='${employee}' and company_id='${A}'`);
  assert.equal((await q(`select role from company_memberships where user_id='${employee}'`))[0].role, "foreman", "owner can manage another member's role");
  checks += 1;
  await as(admin);
  await db.exec(`insert into company_memberships(company_id,user_id,role) values('${B}','${invited}','employee')`);
  await db.exec(`update company_memberships set status='inactive' where company_id='${B}' and user_id='${invited}'`);
  assert.equal((await q(`select status from company_memberships where company_id='${B}' and user_id='${invited}'`))[0].status, "inactive", "administrator can create and revoke membership");
  checks += 1;
  await as(newcomer);
  await db.exec(`insert into company_memberships(company_id,user_id,role,status,is_primary) values('${C}','${newcomer}','owner','active',true)`);
  assert.equal((await q(`select role from company_memberships where company_id='${C}' and user_id='${newcomer}'`))[0].role, "owner", "actual company owner can bootstrap onboarding membership");
  checks += 1;
  await as(null, "service_role");
  await db.exec(`insert into company_memberships(company_id,user_id,role) values('${A}','${invited}','subcontractor')`);
  checks += 1;
  await as(null, "anon");
  await denied(`insert into company_memberships(company_id,user_id,role) values('${A}','00000000-0000-4000-8000-000000000999','owner')`, "anonymous membership insert is denied");
  await as(leaver);
  await db.exec(`delete from company_memberships where user_id='${leaver}'`);
  assert.equal((await q(`select count(*)::int as total from company_memberships where user_id='${leaver}'`))[0].total, 0, "existing own leave policy is not expanded or removed");
  checks += 1;
  await root();
  await db.exec(migration);
  const functionRow = (await q("select prosecdef, proconfig, has_function_privilege('authenticated', oid, 'EXECUTE') as callable from pg_proc where oid='public.guard_company_membership_writes()'::regprocedure"))[0];
  assert.equal(functionRow.prosecdef, false, "guard does not add SECURITY DEFINER authority");
  assert.equal(functionRow.callable, false, "guard is not a public RPC capability");
  assert.equal((await q("select count(*)::int as total from pg_trigger where tgrelid='public.company_memberships'::regclass and tgname='trg_company_memberships_guard_writes'"))[0].total, 1, "migration reapplication leaves one guard");
  checks += 3;
  console.log("Company membership write guard: " + checks + " isolated PostgreSQL assertions passed.");
} finally { await db.close(); }
