begin;

create table public.blueprint_revision_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  blueprint_version_id uuid not null,
  acknowledged_by uuid not null references public.profiles(id) on delete restrict,
  acknowledged_at timestamptz not null default now(),
  foreign key (blueprint_version_id, company_id, project_id)
    references public.blueprint_versions(id, company_id, project_id) on delete cascade,
  unique (blueprint_version_id, acknowledged_by)
);

create index blueprint_revision_ack_project_idx
  on public.blueprint_revision_acknowledgments(company_id, project_id, blueprint_version_id);
alter table public.blueprint_revision_acknowledgments enable row level security;
create policy blueprint_revision_ack_select on public.blueprint_revision_acknowledgments
for select to authenticated using (public.is_company_member(company_id));
create policy blueprint_revision_ack_insert on public.blueprint_revision_acknowledgments
for insert to authenticated with check (
  public.is_company_member(company_id) and acknowledged_by = auth.uid()
  and public.blueprint_project_belongs_to_company(project_id, company_id)
);

create or replace function public.set_blueprint_revision_review_status(
  p_company_id uuid, p_project_id uuid, p_blueprint_version_id uuid, p_status text
) returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if p_status not in ('in_review', 'approved') then
    raise exception 'Revision review status must be in_review or approved.' using errcode = '22023';
  end if;
  if not public.has_company_role(p_company_id, array['owner','administrator','operations_manager','project_manager','superintendent']) then
    raise exception 'Blueprint revision approval is not authorized.' using errcode = '42501';
  end if;
  update public.blueprint_versions set status = p_status
  where id = p_blueprint_version_id and company_id = p_company_id and project_id = p_project_id
    and status in ('draft', 'in_review', 'approved');
  if not found then raise exception 'Active Blueprint revision was not found.' using errcode = 'P0002'; end if;
end;
$$;

revoke all on function public.set_blueprint_revision_review_status(uuid, uuid, uuid, text) from public;
grant execute on function public.set_blueprint_revision_review_status(uuid, uuid, uuid, text) to authenticated;

commit;
