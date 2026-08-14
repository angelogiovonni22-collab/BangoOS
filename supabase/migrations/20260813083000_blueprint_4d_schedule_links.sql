begin;
create table public.blueprint_model_schedule_links (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 project_id uuid not null references public.projects(id) on delete cascade, blueprint_version_id uuid not null,
 task_id uuid not null references public.tasks(id) on delete cascade, element_key text not null check(char_length(element_key) between 1 and 240),
 discipline text not null default 'Architectural', created_by uuid not null references public.profiles(id) on delete restrict, created_at timestamptz not null default now(),
 foreign key(blueprint_version_id,company_id,project_id) references public.blueprint_versions(id,company_id,project_id) on delete cascade,
 unique(blueprint_version_id,element_key), unique(id,company_id,project_id)
);
alter table public.blueprint_model_schedule_links enable row level security;
create policy blueprint_4d_select on public.blueprint_model_schedule_links for select to authenticated using(public.is_company_member(company_id));
create policy blueprint_4d_insert on public.blueprint_model_schedule_links for insert to authenticated with check(public.is_company_member(company_id) and public.blueprint_project_belongs_to_company(project_id,company_id) and created_by=auth.uid() and exists(select 1 from public.tasks where id=task_id and company_id=blueprint_model_schedule_links.company_id and project_id=blueprint_model_schedule_links.project_id));
create policy blueprint_4d_update on public.blueprint_model_schedule_links for update to authenticated using(public.is_company_member(company_id)) with check(public.is_company_member(company_id));
create policy blueprint_4d_delete on public.blueprint_model_schedule_links for delete to authenticated using(public.is_company_member(company_id));
commit;
