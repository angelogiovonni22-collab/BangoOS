begin;

create table if not exists public.compliance_counsel_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  jurisdiction_pack_id text not null references public.compliance_jurisdiction_packs(pack_id),
  ruleset_id text not null,
  ruleset_version text not null,
  review_scope text not null,
  disposition text not null,
  reviewer_name text not null,
  reviewer_organization text,
  reviewer_capacity text not null,
  reviewed_at timestamptz not null,
  recorded_by_membership_id uuid not null references public.company_memberships(id) on delete restrict,
  recorded_by_role text not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint compliance_counsel_review_disposition_check
    check (disposition in ('NO_OBJECTION','CHANGES_REQUIRED','ADVISORY_ONLY')),
  constraint compliance_counsel_review_capacity_check
    check (reviewer_capacity in ('counsel','authorized_reviewer')),
  constraint compliance_counsel_review_scope_not_blank
    check (length(trim(review_scope)) > 0),
  constraint compliance_counsel_review_reviewer_not_blank
    check (length(trim(reviewer_name)) > 0)
);

create index if not exists compliance_counsel_reviews_lookup_idx
  on public.compliance_counsel_reviews(company_id, estimate_id, reviewed_at desc, created_at desc);

alter table public.compliance_counsel_reviews enable row level security;

create policy compliance_counsel_reviews_company_members_read
on public.compliance_counsel_reviews
for select
to authenticated
using (public.is_company_member(company_id));

-- No authenticated INSERT/UPDATE/DELETE policies. Reviews are append-only and can only be
-- recorded through the authorization-enforcing RPC below.

create or replace function public.record_compliance_counsel_review(
  p_company_id uuid,
  p_estimate_id uuid,
  p_jurisdiction_pack_id text,
  p_review_scope text,
  p_disposition text,
  p_reviewer_name text,
  p_reviewer_organization text default null,
  p_reviewer_capacity text default 'counsel',
  p_reviewed_at timestamptz default now(),
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.compliance_counsel_reviews
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_membership public.company_memberships%rowtype;
  v_pack public.compliance_jurisdiction_packs%rowtype;
  v_review public.compliance_counsel_reviews%rowtype;
begin
  if auth.uid() is null then
    raise exception 'COUNSEL_REVIEW_UNAUTHENTICATED' using errcode = '42501';
  end if;

  select cm.* into v_membership
  from public.company_memberships cm
  where cm.company_id = p_company_id
    and cm.user_id = auth.uid()
    and cm.status = 'active'
    and cm.role in ('owner','administrator')
  limit 1;

  if v_membership.id is null then
    raise exception 'COUNSEL_REVIEW_AUTHORIZATION_REQUIRED' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.estimates e
    where e.id = p_estimate_id and e.company_id = p_company_id
  ) then
    raise exception 'COUNSEL_REVIEW_ESTIMATE_NOT_FOUND' using errcode = '23514';
  end if;

  select p.* into v_pack
  from public.compliance_jurisdiction_packs p
  where p.pack_id = p_jurisdiction_pack_id;

  if v_pack.pack_id is null then
    raise exception 'COUNSEL_REVIEW_JURISDICTION_PACK_NOT_FOUND' using errcode = '23514';
  end if;

  if trim(coalesce(p_review_scope, '')) = '' or trim(coalesce(p_reviewer_name, '')) = '' then
    raise exception 'COUNSEL_REVIEW_REQUIRED_FIELDS_MISSING' using errcode = '23514';
  end if;

  if p_disposition not in ('NO_OBJECTION','CHANGES_REQUIRED','ADVISORY_ONLY') then
    raise exception 'COUNSEL_REVIEW_INVALID_DISPOSITION' using errcode = '23514';
  end if;

  if p_reviewer_capacity not in ('counsel','authorized_reviewer') then
    raise exception 'COUNSEL_REVIEW_INVALID_CAPACITY' using errcode = '23514';
  end if;

  insert into public.compliance_counsel_reviews (
    company_id,
    estimate_id,
    jurisdiction_pack_id,
    ruleset_id,
    ruleset_version,
    review_scope,
    disposition,
    reviewer_name,
    reviewer_organization,
    reviewer_capacity,
    reviewed_at,
    recorded_by_membership_id,
    recorded_by_role,
    notes,
    metadata
  ) values (
    p_company_id,
    p_estimate_id,
    v_pack.pack_id,
    v_pack.ruleset_id,
    v_pack.ruleset_version,
    trim(p_review_scope),
    p_disposition,
    trim(p_reviewer_name),
    nullif(trim(coalesce(p_reviewer_organization, '')), ''),
    p_reviewer_capacity,
    coalesce(p_reviewed_at, now()),
    v_membership.id,
    v_membership.role,
    p_notes,
    coalesce(p_metadata, '{}'::jsonb)
  ) returning * into v_review;

  return v_review;
end;
$$;

revoke all on function public.record_compliance_counsel_review(uuid, uuid, text, text, text, text, text, text, timestamptz, text, jsonb) from public;
revoke all on function public.record_compliance_counsel_review(uuid, uuid, text, text, text, text, text, text, timestamptz, text, jsonb) from anon;
grant execute on function public.record_compliance_counsel_review(uuid, uuid, text, text, text, text, text, text, timestamptz, text, jsonb) to authenticated;
grant select on public.compliance_counsel_reviews to authenticated;

comment on table public.compliance_counsel_reviews is
  'Append-only audit evidence of counsel or authorized human review. A recorded disposition never overrides deterministic compliance gates.';

commit;
