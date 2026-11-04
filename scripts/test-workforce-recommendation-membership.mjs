// Run only with an isolated pinned PGlite runtime; no production credentials.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const actor = "00000000-0000-4000-8000-000000000001";
const company = "00000000-0000-4000-8000-000000000002";
const otherCompany = "00000000-0000-4000-8000-000000000003";
const outsider = "00000000-0000-4000-8000-000000000004";
const q = async (sql) => (await db.query(sql)).rows;
try {
  await db.exec(`
    create table profiles(id uuid primary key,company_id uuid,role text,updated_at timestamptz,unique(id,company_id));
    create table company_memberships(id uuid primary key default gen_random_uuid(),company_id uuid not null,user_id uuid not null,status text,role text,is_primary boolean default false,joined_at timestamptz,created_at timestamptz default now(),unique(company_id,user_id));
    create function company_role_weight(text) returns integer language sql as $$ select 0 $$;
    create table workforce_orion_recommendations(id uuid primary key default gen_random_uuid(),company_id uuid not null,actor_profile_id uuid,
      constraint workforce_orion_recommendations_actor_company_fkey foreign key(actor_profile_id,company_id) references profiles(id,company_id) on delete set null);
    insert into profiles(id,company_id,role) values('${actor}','${company}','foreman'),('${outsider}','${otherCompany}','foreman');
  `);
  const foundation = await readFile("supabase/migrations/20260729170000_multi_company_foundation.sql","utf8");
  const fn = foundation.match(/create or replace function public\.trg_company_memberships_sync_profiles_fn\(\)[\s\S]*?\$\$;/i)?.[0];
  assert.ok(fn,"use the existing production membership/profile synchronization function");
  await db.exec(fn);
  await db.exec(`
    create trigger membership_sync after insert or update or delete on company_memberships for each row execute function trg_company_memberships_sync_profiles_fn();
    insert into company_memberships(company_id,user_id,status,role) values('${company}','${actor}','active','foreman'),('${otherCompany}','${outsider}','active','foreman');
    insert into workforce_orion_recommendations(company_id,actor_profile_id) values('${company}','${actor}');
  `);
  await assert.rejects(db.exec(`update company_memberships set status='inactive' where user_id='${actor}'`),/foreign key/i);
  await db.exec(await readFile(process.argv[3],"utf8"));
  await db.exec(`update company_memberships set status='inactive' where user_id='${actor}'`);
  assert.equal((await q(`select company_id from profiles where id='${actor}'`))[0].company_id,null);
  assert.equal((await q(`select status from company_memberships where user_id='${actor}'`))[0].status,"inactive");
  assert.deepEqual((await q("select company_id,actor_profile_id from workforce_orion_recommendations"))[0],{company_id:company,actor_profile_id:actor});
  await assert.rejects(db.exec(`insert into workforce_orion_recommendations(company_id,actor_profile_id) values('${company}','${outsider}')`),/foreign key/i);
  await assert.rejects(db.exec(`delete from company_memberships where user_id='${actor}'`),/foreign key/i);
  await assert.rejects(db.exec(`delete from profiles where id='${actor}'`),/foreign key/i);
  await db.exec(`insert into company_memberships(company_id,user_id,status,role) values('${otherCompany}','${actor}','active','employee')`);
  assert.equal((await q(`select company_id from profiles where id='${actor}'`))[0].company_id,otherCompany);
  assert.deepEqual((await q("select company_id,actor_profile_id from workforce_orion_recommendations"))[0],{company_id:company,actor_profile_id:actor});
  console.log("Recommendation membership history: 9 regression assertions passed");
} finally { await db.close(); }
