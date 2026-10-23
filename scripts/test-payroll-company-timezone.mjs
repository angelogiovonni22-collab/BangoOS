// Isolated PostgreSQL regression for local payroll-date classification.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.argv[2];
const timezoneMigration = process.argv[3];
if (!modulePath || !timezoneMigration) throw new Error('Usage: node scripts/test-payroll-company-timezone.mjs /absolute/path/to/pglite/dist/index.js migration.sql');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const company = '00000000-0000-4000-8000-000000000012';
const employee = '00000000-0000-4000-8000-000000000013';
const project = '00000000-0000-4000-8000-000000000014';
const actor = '00000000-0000-4000-8000-000000000011';
const query = async (sql, values = []) => (await db.query(sql, values)).rows;

try {
  await db.exec(`
    create role authenticated; create role anon;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$select '${actor}'::uuid$$;
    create table public.companies(id uuid primary key, timezone text);
    create table public.projects(id uuid primary key,company_id uuid not null);
    create table public.profiles(id uuid primary key,first_name text,last_name text);
    create table public.employees(id uuid primary key,company_id uuid not null,profile_id uuid,employee_number text,position_title text,employment_status text,unique(id,company_id));
    create table public.workforce_time_entries(id uuid primary key,company_id uuid not null,employee_id uuid not null,project_id uuid,started_at timestamptz,ended_at timestamptz,break_minutes integer,status text,approved_at timestamptz,approved_by uuid,unique(id,company_id));
    create function public.has_company_role(c uuid,r text[]) returns boolean language sql as $$select c='${company}'::uuid$$;
    insert into public.companies values('${company}','America/New_York');
    insert into public.projects values('${project}','${company}');
    insert into public.employees values('${employee}','${company}',null,'TZ-1','Test','active');
  `);
  await db.exec(await readFile('supabase/migrations/20260828010000_payroll_workforce_pay_operations.sql','utf8'));
  await db.exec(await readFile('supabase/migrations/20261007222345_audit_payroll_time_claims_and_void_recovery.sql','utf8'));
  await db.exec(await readFile('supabase/migrations/20261007223036_audit_payroll_project_cost_snapshots.sql','utf8'));
  await db.exec(await readFile(timezoneMigration,'utf8'));
  await db.exec(`
    insert into public.payroll_employee_settings(company_id,employee_id,hourly_rate) values('${company}','${employee}',20);
    insert into public.workforce_time_entries(id,company_id,employee_id,project_id,started_at,ended_at,break_minutes,status)
    values(gen_random_uuid(),'${company}','${employee}','${project}','2026-12-07 02:30:00Z','2026-12-07 03:30:00Z',0,'approved');
    grant usage on schema public,auth to authenticated;
    grant select,insert,update,delete on public.companies,public.projects,public.profiles,public.employees,public.workforce_time_entries,public.payroll_periods,public.payroll_lines,public.payroll_employee_settings to authenticated;
    set role authenticated;
  `);
  const period = (await query("select public.build_weekly_payroll($1,'2026-12-01','2026-12-06','2026-12-11') id",[company]))[0].id;
  const line = (await query('select gross_pay,project_allocations from public.payroll_lines where payroll_period_id=$1',[period]))[0];
  assert.equal(Number(line.gross_pay),20);
  assert.equal(line.project_allocations.length,1);
  assert.equal(line.project_allocations[0].source_date_timezone,'America/New_York');
  assert.equal(line.project_allocations[0].source_time_entries.length,1);
  await db.exec('reset role');
  await query("update public.companies set timezone=null where id=$1",[company]);
  await db.exec('set role authenticated');
  await assert.rejects(query("select public.build_weekly_payroll($1,'2026-12-08','2026-12-14','2026-12-18')",[company]),/Company payroll timezone is not configured/);
  console.log('PASS: weekly payroll uses the company timezone for period membership, records that timezone in project snapshots, and fails closed when timezone is missing.');
} finally {
  await db.close();
}
