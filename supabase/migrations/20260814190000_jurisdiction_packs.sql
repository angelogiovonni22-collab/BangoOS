begin;

create table if not exists public.compliance_jurisdiction_packs (
  pack_id text primary key,
  jurisdiction text not null,
  ruleset_id text not null,
  ruleset_version text not null,
  effective_from date not null,
  effective_to date null,
  status text not null default 'active',
  statutory_references jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint compliance_jurisdiction_pack_status_check check (status in ('active','superseded','draft')),
  constraint compliance_jurisdiction_pack_effective_range_check check (effective_to is null or effective_to >= effective_from),
  unique (jurisdiction, ruleset_id, ruleset_version)
);

insert into public.compliance_jurisdiction_packs (
  pack_id,
  jurisdiction,
  ruleset_id,
  ruleset_version,
  effective_from,
  effective_to,
  status,
  statutory_references,
  metadata
)
values (
  'US-OH-RESIDENTIAL-HOME-CONSTRUCTION',
  'OH',
  'OH_RESIDENTIAL_HOME_CONSTRUCTION',
  '2026-08-14.1',
  date '2026-08-14',
  null,
  'active',
  '["ORC 4722.01","ORC 4722.02","ORC 4722.04"]'::jsonb,
  jsonb_build_object('country', 'US', 'scope', 'residential_home_construction')
)
on conflict (pack_id) do nothing;

create index if not exists compliance_jurisdiction_packs_lookup_idx
  on public.compliance_jurisdiction_packs(jurisdiction, ruleset_id, effective_from desc);

alter table public.compliance_jurisdiction_packs enable row level security;

create policy compliance_jurisdiction_packs_authenticated_read
on public.compliance_jurisdiction_packs
for select
to authenticated
using (true);

-- No authenticated INSERT/UPDATE/DELETE policies. Jurisdiction packs are deployment-controlled legal configuration.

create or replace function public.resolve_compliance_jurisdiction_pack(
  p_jurisdiction text,
  p_ruleset_id text,
  p_on_date date default current_date
)
returns public.compliance_jurisdiction_packs
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select p.*
  from public.compliance_jurisdiction_packs p
  where p.jurisdiction = upper(trim(p_jurisdiction))
    and p.ruleset_id = p_ruleset_id
    and p.status = 'active'
    and p.effective_from <= p_on_date
    and (p.effective_to is null or p.effective_to >= p_on_date)
  order by p.effective_from desc, p.ruleset_version desc
  limit 1;
$$;

grant select on public.compliance_jurisdiction_packs to authenticated;
grant execute on function public.resolve_compliance_jurisdiction_pack(text, text, date) to authenticated;

comment on table public.compliance_jurisdiction_packs is
  'Deployment-controlled registry of versioned compliance rule packs and their effective-date windows.';

commit;
