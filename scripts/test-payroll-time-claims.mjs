// Isolated PostgreSQL regression. Supply an installed, pinned PGlite module path;
// no Production credentials are used and no repository dependency is required.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const modulePath = process.argv[2];
if (!modulePath) throw new Error('Usage: node scripts/test-payroll-time-claims.mjs /absolute/path/to/pglite/dist/index.js');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const company = '00000000-0000-4000-8000-000000000002';
const employee = '00000000-0000-4000-8000-000000000003';
const source = '00000000-0000-4000-8000-000000000004';
const project = '00000000-0000-4000-8000-000000000005';
const migration = 'supabase/migrations/20261007222345_audit_payroll_time_claims_and_void_recovery.sql';
const query = async (sql, values = []) => (await db.query(sql, values)).rows;
const build = async (end = '2026-10-04') => (await query('select public.build_weekly_payroll($1,$2,$3,$4) id', [company,'2026-09-28',end,'2026-10-09']))[0].id;
const workspace = async () => (await query('select public.get_payroll_workspace($1) data',[company]))[0].data;
try {
  await db.exec(`
    create role authenticated; create role anon;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$select '00000000-0000-4000-8000-000000000001'::uuid$$;
    create table public.companies(id uuid primary key);
    create table public.profiles(id uuid primary key,first_name text,last_name text);
    create table public.employees(id uuid primary key,company_id uuid not null,profile_id uuid,employee_number text,position_title text,employment_status text,unique(id,company_id));
    create table public.workforce_time_entries(id uuid primary key,company_id uuid not null,employee_id uuid not null,project_id uuid,started_at timestamptz,ended_at timestamptz,break_minutes integer,status text,unique(id,company_id));
    create function public.has_company_role(c uuid,r text[]) returns boolean language sql as $$select c='${company}'::uuid and coalesce(current_setting('bos.test.authorized',true),'true')='true'$$;
    insert into public.companies values('${company}');
    insert into public.employees values('${employee}','${company}',null,'AUDIT-1','Test','active');
    insert into public.workforce_time_entries values('${source}','${company}','${employee}','${project}','2026-09-28 09:00Z','2026-09-28 10:00Z',0,'approved');
  `);
  await db.exec(await readFile('supabase/migrations/20260828010000_payroll_workforce_pay_operations.sql','utf8'));
  await db.exec(await readFile('supabase/migrations/20260828011000_payroll_workspace_rpcs.sql','utf8'));
  await db.exec(`insert into public.payroll_employee_settings(company_id,employee_id,hourly_rate) values('${company}','${employee}',20)`);
  // Reproduce the defect before installing the repair.
  await build(); await build('2026-10-03');
  assert.equal(Number((await query('select sum(gross_pay) gross from public.payroll_lines'))[0].gross),40);
  await assert.rejects(db.exec(await readFile(migration,'utf8')), /duplicate key/);
  await db.exec('rollback; truncate public.payroll_periods cascade;');
  await db.exec(await readFile(migration,'utf8'));
  await db.exec('grant usage on schema public,auth to authenticated; grant select,insert,update,delete on public.companies,public.profiles,public.employees,public.workforce_time_entries,public.payroll_periods,public.payroll_lines,public.payroll_employee_settings to authenticated; set role authenticated;');
  assert.equal(Number((await workspace()).approved_unprocessed_hours),1);
  const first = await build();
  assert.equal(Number((await workspace()).approved_unprocessed_hours),0);
  await assert.rejects(build('2026-10-03'), /No approved unprocessed time/);
  assert.equal((await query('select count(*) n from public.payroll_periods'))[0].n,1);
  // Direct period/line writes cannot bypass the source claim.
  const other = (await query("insert into public.payroll_periods(company_id,period_start,period_end,pay_date) values($1,'2026-09-28','2026-10-03','2026-10-09') returning id",[company]))[0].id;
  await assert.rejects(query('insert into public.payroll_lines(company_id,payroll_period_id,employee_id,employee_name,source_time_entry_ids) values($1,$2,$3,$4,$5)',[company,other,employee,'AUDIT',[source]]),/already included/);
  await assert.rejects(query('insert into public.payroll_lines(company_id,payroll_period_id,employee_id,employee_name,source_time_entry_ids) values($1,$2,$3,$4,$5)',[company,other,employee,'AUDIT',[source,source]]),/distinct and non-null/);
  await assert.rejects(query('insert into public.payroll_lines(company_id,payroll_period_id,employee_id,employee_name,source_time_entry_ids) values($1,$2,$3,$4,$5)',[company,other,employee,'AUDIT',[null]]),/distinct and non-null/);
  await assert.rejects(query('insert into public.payroll_lines(company_id,payroll_period_id,employee_id,employee_name,source_time_entry_ids) values($1,$2,$3,$4,$5)',[company,other,employee,'AUDIT',['00000000-0000-4000-8000-000000000099']]),/source time must/);
  await assert.rejects(query('update public.payroll_periods set period_end=period_end+1 where id=$1',[other]),/dates are immutable/);
  await assert.rejects(query('delete from public.workforce_time_entries where id=$1',[source]),/foreign key/);
  assert.equal((await query('delete from public.payroll_time_entry_claims returning *')).length,0);
  await assert.rejects(query('insert into public.payroll_time_entry_claims(company_id,time_entry_id,payroll_line_id) select company_id,time_entry_id,payroll_line_id from public.payroll_time_entry_claims'),/row-level security/);
  await assert.rejects(query('update public.payroll_lines set source_time_entry_ids=\'{}\''),/immutable/);
  await query('delete from public.payroll_periods where id=$1',[other]);
  // An overlapping window may legitimately contain new approved time; only the
  // unused source is included, rather than rejecting the whole date window.
  const additional = '00000000-0000-4000-8000-000000000006';
  await query('insert into public.workforce_time_entries values($1,$2,$3,$4,$5,$6,0,$7)',[additional,company,employee,project,'2026-09-29 09:00Z','2026-09-29 10:00Z','approved']);
  const second = await build('2026-10-03');
  assert.deepEqual((await query('select source_time_entry_ids from public.payroll_lines where payroll_period_id=$1',[second]))[0].source_time_entry_ids,[additional]);
  await query('delete from public.payroll_periods where id=$1',[second]);
  await query('delete from public.workforce_time_entries where id=$1',[additional]);
  await query("select public.set_payroll_status($1,$2,'void')",[company,first]);
  assert.equal(Number((await workspace()).approved_unprocessed_hours),1);
  const replacement = await build();
  assert.notEqual(replacement,first);
  assert.equal((await query('select count(*) n from public.payroll_lines'))[0].n,2);
  assert.equal((await query('select count(*) n from public.payroll_time_entry_claims'))[0].n,1);
  await assert.rejects(query("update public.payroll_periods set status='draft' where id=$1",[first]),/immutable/);
  await query("select public.set_payroll_status($1,$2,'approved')",[company,replacement]);
  await assert.rejects(query('update public.payroll_lines set gross_pay=100 where payroll_period_id=$1',[replacement]),/Only draft/);
  await assert.rejects(query('delete from public.payroll_periods where id=$1',[replacement]),/cannot be deleted/);
  await query("select public.set_payroll_status($1,$2,'exported')",[company,replacement]);
  await assert.rejects(query("select public.set_payroll_status($1,$2,'void')",[company,replacement]),/not allowed/);
  await db.exec("set bos.test.authorized='false'");
  assert.equal((await query('select * from public.payroll_time_entry_claims')).length,0);
  await assert.rejects(build('2026-10-03'), /Not authorized/);
  await assert.rejects(workspace(), /Not authorized/);
  await db.exec('reset role; set role anon;');
  await assert.rejects(workspace(), /permission denied/);
  console.log('PASS: pre-fix double counting reproduced; conflicting legacy migration fails closed; active source uniqueness, direct-write RLS, void recovery, retained history, approved/exported guards, and denied-role checks passed.');
} finally { await db.close(); }
