begin;

create table public.workforce_time_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null,
  project_id uuid,
  assignment_id uuid,
  started_at timestamptz not null,
  ended_at timestamptz,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  status text not null default 'open' check (status in ('open','submitted','approved','rejected')),
  source text not null default 'mobile' check (source in ('mobile','web','import','manager')),
  notes text,
  created_by uuid not null,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (employee_id, company_id) references public.employees(id, company_id) on delete cascade,
  foreign key (project_id, company_id) references public.projects(id, company_id) on delete restrict,
  foreign key (assignment_id, company_id) references public.workforce_assignments(id, company_id) on delete set null,
  check (ended_at is null or ended_at >= started_at),
  check ((status = 'open' and ended_at is null) or (status <> 'open' and ended_at is not null))
);

create unique index workforce_time_entries_one_open_employee
  on public.workforce_time_entries(company_id, employee_id) where status = 'open';
create index workforce_time_entries_company_day on public.workforce_time_entries(company_id, started_at desc);
create index workforce_time_entries_project on public.workforce_time_entries(company_id, project_id, started_at desc);

alter table public.workforce_time_entries enable row level security;
create policy workforce_time_entries_select on public.workforce_time_entries for select to authenticated using (
  public.is_company_member(company_id) and (
    exists(select 1 from public.employees e where e.id=employee_id and e.company_id=company_id and e.profile_id=auth.uid())
    or public.has_company_role(company_id,array['owner','administrator','operations_manager','project_manager','superintendent','foreman','office_manager'])
  )
);
create policy workforce_time_entries_insert on public.workforce_time_entries for insert to authenticated with check (
  public.is_company_member(company_id) and created_by=auth.uid() and (
    exists(select 1 from public.employees e where e.id=employee_id and e.company_id=company_id and e.profile_id=auth.uid())
    or public.has_company_role(company_id,array['owner','administrator','operations_manager','project_manager','superintendent','foreman','office_manager'])
  )
);
create policy workforce_time_entries_update on public.workforce_time_entries for update to authenticated using (
  public.has_company_role(company_id,array['owner','administrator','operations_manager','project_manager','superintendent','foreman','office_manager'])
) with check (public.has_company_role(company_id,array['owner','administrator','operations_manager','project_manager','superintendent','foreman','office_manager']));

create or replace function public.record_workforce_time_event(p_company_id uuid,p_employee_id uuid,p_action text,p_project_id uuid default null,p_assignment_id uuid default null,p_notes text default null)
returns public.workforce_time_entries language plpgsql security invoker set search_path=public as $$
declare v_entry public.workforce_time_entries;
begin
  if p_action not in ('clock_in','clock_out') then raise exception 'Unsupported time event'; end if;
  if not (exists(select 1 from public.employees e where e.id=p_employee_id and e.company_id=p_company_id and e.profile_id=auth.uid()) or public.has_company_role(p_company_id,array['owner','administrator','operations_manager','project_manager','superintendent','foreman','office_manager'])) then raise exception 'Not authorized'; end if;
  if p_action='clock_in' then
    insert into public.workforce_time_entries(company_id,employee_id,project_id,assignment_id,started_at,status,source,notes,created_by)
    values(p_company_id,p_employee_id,p_project_id,p_assignment_id,now(),'open','mobile',nullif(btrim(p_notes),''),auth.uid()) returning * into v_entry;
  else
    update public.workforce_time_entries set ended_at=now(),status='submitted',notes=coalesce(nullif(btrim(p_notes),''),notes),updated_at=now()
    where company_id=p_company_id and employee_id=p_employee_id and status='open' returning * into v_entry;
    if v_entry.id is null then raise exception 'No open time entry'; end if;
  end if;
  return v_entry;
end $$;
grant execute on function public.record_workforce_time_event(uuid,uuid,text,uuid,uuid,text) to authenticated;
commit;
