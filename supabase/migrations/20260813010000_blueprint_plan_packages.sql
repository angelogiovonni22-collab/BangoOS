begin;

create table public.blueprint_plan_packages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  blueprint_version_id uuid not null,
  package_name text not null check (char_length(btrim(package_name)) between 1 and 160),
  token_hash text not null unique check (char_length(token_hash) = 64),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  expires_at timestamptz not null check (expires_at > created_at),
  revoked_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (blueprint_version_id, company_id, project_id)
    references public.blueprint_versions(id, company_id, project_id) on delete cascade
);

create index blueprint_plan_packages_revision_idx on public.blueprint_plan_packages(company_id, project_id, blueprint_version_id, created_at desc);
alter table public.blueprint_plan_packages enable row level security;
create policy blueprint_packages_select on public.blueprint_plan_packages for select to authenticated using (public.is_company_member(company_id));
create policy blueprint_packages_insert on public.blueprint_plan_packages for insert to authenticated with check (
  public.is_company_member(company_id) and public.blueprint_project_belongs_to_company(project_id, company_id) and created_by = auth.uid()
);
create policy blueprint_packages_update on public.blueprint_plan_packages for update to authenticated
  using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));

create or replace function public.validate_blueprint_plan_package(package_token text)
returns table(package_name text, expires_at timestamptz, snapshot jsonb, is_valid boolean, failure_reason text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare token_digest text; package_row public.blueprint_plan_packages%rowtype;
begin
  if package_token is null or btrim(package_token) = '' then return query select null::text, null::timestamptz, null::jsonb, false, 'token_missing'::text; return; end if;
  token_digest := encode(digest(package_token, 'sha256'), 'hex');
  select * into package_row from public.blueprint_plan_packages where token_hash = token_digest limit 1;
  if not found then return query select null::text, null::timestamptz, null::jsonb, false, 'token_not_found'::text; return; end if;
  if package_row.revoked_at is not null then return query select package_row.package_name, package_row.expires_at, null::jsonb, false, 'token_revoked'::text; return; end if;
  if package_row.expires_at <= now() then return query select package_row.package_name, package_row.expires_at, null::jsonb, false, 'token_expired'::text; return; end if;
  return query select package_row.package_name, package_row.expires_at, package_row.snapshot, true, null::text;
end; $$;

revoke all on function public.validate_blueprint_plan_package(text) from public;
grant execute on function public.validate_blueprint_plan_package(text) to anon, authenticated;

commit;
