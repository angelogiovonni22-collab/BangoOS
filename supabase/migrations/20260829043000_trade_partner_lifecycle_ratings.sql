begin;

alter table public.trade_partner_assignments
  add column if not exists lifecycle_status text not null default 'active',
  add column if not exists lifecycle_reason text,
  add column if not exists lifecycle_ended_at timestamptz,
  add column if not exists lifecycle_ended_by uuid references public.profiles(id) on delete set null,
  add column if not exists replaced_by_assignment_id uuid references public.trade_partner_assignments(id) on delete set null;

alter table public.trade_partner_assignments
  drop constraint if exists trade_partner_assignments_lifecycle_status_check;
alter table public.trade_partner_assignments
  add constraint trade_partner_assignments_lifecycle_status_check
  check (lifecycle_status in ('active','completed','project_completed','removed','terminated','replaced'));

update public.trade_partner_assignments
set lifecycle_status = 'completed',
    lifecycle_ended_at = coalesce(lifecycle_ended_at, updated_at)
where assignment_status = 'archived'
  and lifecycle_status = 'active';

alter table public.vendors
  add column if not exists performance_rating numeric(3,2),
  add column if not exists performance_review_count integer not null default 0,
  add column if not exists rehire_status text not null default 'approved';

alter table public.vendors
  drop constraint if exists vendors_rehire_status_check;
alter table public.vendors
  add constraint vendors_rehire_status_check
  check (rehire_status in ('approved','review_before_assignment','do_not_rehire'));

create table if not exists public.trade_partner_performance_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  assignment_id uuid not null unique references public.trade_partner_assignments(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  quality smallint not null check (quality between 1 and 5),
  schedule_reliability smallint not null check (schedule_reliability between 1 and 5),
  communication smallint not null check (communication between 1 and 5),
  safety_compliance smallint not null check (safety_compliance between 1 and 5),
  professionalism smallint not null check (professionalism between 1 and 5),
  overall_rating numeric(3,2) generated always as (
    round((quality + schedule_reliability + communication + safety_compliance + professionalism)::numeric / 5.0, 2)
  ) stored,
  comments text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (assignment_id, company_id) references public.trade_partner_assignments(id, company_id) on delete cascade,
  foreign key (vendor_id, company_id) references public.vendors(id, company_id) on delete cascade
);

create index if not exists trade_partner_reviews_vendor_idx
  on public.trade_partner_performance_reviews(company_id, vendor_id, reviewed_at desc);
create index if not exists trade_partner_assignments_lifecycle_idx
  on public.trade_partner_assignments(company_id, project_id, lifecycle_status, assignment_status);

alter table public.trade_partner_performance_reviews enable row level security;

drop policy if exists trade_partner_performance_reviews_internal_select on public.trade_partner_performance_reviews;
create policy trade_partner_performance_reviews_internal_select on public.trade_partner_performance_reviews
for select to authenticated using (
  public.has_company_role(company_id, array['owner','administrator','operations_manager','office_manager','project_manager','superintendent'])
);

drop policy if exists trade_partner_performance_reviews_internal_manage on public.trade_partner_performance_reviews;
create policy trade_partner_performance_reviews_internal_manage on public.trade_partner_performance_reviews
for all to authenticated using (
  public.has_company_role(company_id, array['owner','administrator','operations_manager','office_manager','project_manager','superintendent'])
) with check (
  public.has_company_role(company_id, array['owner','administrator','operations_manager','office_manager','project_manager','superintendent'])
);

create or replace function public.refresh_trade_partner_vendor_rating(p_vendor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_avg numeric(3,2);
  v_count integer;
begin
  select company_id into v_company_id from public.vendors where id = p_vendor_id;
  if v_company_id is null then return; end if;

  select round(avg(overall_rating),2), count(*)::integer
  into v_avg, v_count
  from public.trade_partner_performance_reviews
  where company_id = v_company_id and vendor_id = p_vendor_id;

  update public.vendors
  set performance_rating = v_avg,
      performance_review_count = coalesce(v_count,0),
      updated_at = now()
  where id = p_vendor_id and company_id = v_company_id;
end;
$$;

create or replace function public.trade_partner_review_rating_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_trade_partner_vendor_rating(coalesce(new.vendor_id, old.vendor_id));
  if tg_op = 'UPDATE' and old.vendor_id is distinct from new.vendor_id then
    perform public.refresh_trade_partner_vendor_rating(old.vendor_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trade_partner_review_rating_refresh on public.trade_partner_performance_reviews;
create trigger trade_partner_review_rating_refresh
after insert or update or delete on public.trade_partner_performance_reviews
for each row execute function public.trade_partner_review_rating_trigger();

create or replace function public.submit_trade_partner_performance_review(
  p_assignment_id uuid,
  p_quality integer,
  p_schedule_reliability integer,
  p_communication integer,
  p_safety_compliance integer,
  p_professionalism integer,
  p_comments text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.trade_partner_assignments%rowtype;
  v_id uuid;
begin
  select * into v_assignment from public.trade_partner_assignments where id = p_assignment_id;
  if not found then raise exception 'Trade Partner assignment not found'; end if;
  if not public.has_company_role(v_assignment.company_id, array['owner','administrator','operations_manager','office_manager','project_manager','superintendent']) then
    raise exception 'Not authorized';
  end if;
  if v_assignment.lifecycle_status = 'active' and v_assignment.assignment_status <> 'archived' then
    raise exception 'End or close the assignment before submitting the final Trade Partner rating';
  end if;
  if p_quality not between 1 and 5 or p_schedule_reliability not between 1 and 5 or p_communication not between 1 and 5 or p_safety_compliance not between 1 and 5 or p_professionalism not between 1 and 5 then
    raise exception 'All Trade Partner ratings must be between 1 and 5';
  end if;

  insert into public.trade_partner_performance_reviews(
    company_id, project_id, assignment_id, vendor_id,
    quality, schedule_reliability, communication, safety_compliance, professionalism,
    comments, reviewed_by, reviewed_at, updated_at
  ) values (
    v_assignment.company_id, v_assignment.project_id, v_assignment.id, v_assignment.vendor_id,
    p_quality, p_schedule_reliability, p_communication, p_safety_compliance, p_professionalism,
    nullif(btrim(coalesce(p_comments,'')),''), auth.uid(), now(), now()
  )
  on conflict (assignment_id) do update set
    quality = excluded.quality,
    schedule_reliability = excluded.schedule_reliability,
    communication = excluded.communication,
    safety_compliance = excluded.safety_compliance,
    professionalism = excluded.professionalism,
    comments = excluded.comments,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.manage_trade_partner_assignment_lifecycle(
  p_assignment_id uuid,
  p_action text,
  p_reason text default null,
  p_replacement_assignment_id uuid default null,
  p_rehire_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.trade_partner_assignments%rowtype;
  v_replacement public.trade_partner_assignments%rowtype;
  v_action text := lower(btrim(coalesce(p_action,'')));
  v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
  v_status text;
begin
  select * into v_assignment from public.trade_partner_assignments where id = p_assignment_id for update;
  if not found then raise exception 'Trade Partner assignment not found'; end if;
  if not public.has_company_role(v_assignment.company_id, array['owner','administrator','operations_manager','office_manager','project_manager','superintendent']) then
    raise exception 'Not authorized';
  end if;

  if v_action = 'end' then
    perform public.close_subcontractor_assignment(p_assignment_id);
    v_status := 'completed';
  elsif v_action in ('remove','terminate','replace') then
    if v_reason is null then raise exception 'A reason is required for this Trade Partner action'; end if;

    if v_action = 'replace' then
      if p_replacement_assignment_id is null then raise exception 'Select a replacement Trade Partner assignment'; end if;
      select * into v_replacement from public.trade_partner_assignments where id = p_replacement_assignment_id;
      if not found or v_replacement.company_id <> v_assignment.company_id or v_replacement.project_id <> v_assignment.project_id then
        raise exception 'Replacement assignment must belong to the same project';
      end if;
      if v_replacement.id = v_assignment.id then raise exception 'Replacement assignment must be different'; end if;
      v_status := 'replaced';
    elsif v_action = 'terminate' then
      v_status := 'terminated';
    else
      v_status := 'removed';
    end if;

    update public.trade_partner_assignments
    set assignment_status = 'archived',
        lifecycle_status = v_status,
        lifecycle_reason = v_reason,
        lifecycle_ended_at = now(),
        lifecycle_ended_by = auth.uid(),
        replaced_by_assignment_id = case when v_action='replace' then p_replacement_assignment_id else null end,
        contract_status = case when contract_status in ('draft','pending_signature') then 'cancelled' else contract_status end,
        updated_by = auth.uid(),
        updated_at = now()
    where id = p_assignment_id;

    if v_action = 'terminate' and p_rehire_status is not null then
      if p_rehire_status not in ('approved','review_before_assignment','do_not_rehire') then
        raise exception 'Invalid rehire status';
      end if;
      update public.vendors
      set rehire_status = p_rehire_status, updated_at = now()
      where id = v_assignment.vendor_id and company_id = v_assignment.company_id;
    end if;
  else
    raise exception 'Unsupported Trade Partner lifecycle action';
  end if;

  if v_action = 'end' then
    update public.trade_partner_assignments
    set lifecycle_status = 'completed',
        lifecycle_reason = v_reason,
        lifecycle_ended_at = now(),
        lifecycle_ended_by = auth.uid(),
        updated_by = auth.uid(),
        updated_at = now()
    where id = p_assignment_id;
  end if;

  return jsonb_build_object('assignmentId', p_assignment_id, 'lifecycleStatus', v_status, 'action', v_action);
end;
$$;

create or replace function public.delete_mistaken_trade_partner_assignment(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.trade_partner_assignments%rowtype;
begin
  select * into v_assignment from public.trade_partner_assignments where id = p_assignment_id for update;
  if not found then raise exception 'Trade Partner assignment not found'; end if;
  if not public.has_company_role(v_assignment.company_id, array['owner','administrator']) then raise exception 'Only an owner or administrator can delete a mistaken assignment'; end if;
  if v_assignment.contract_status <> 'draft' or v_assignment.assignment_status = 'active' or v_assignment.mobilization_status <> 'not_cleared' then
    raise exception 'This assignment has progressed too far to delete. Use Remove, End, Terminate, or Replace instead';
  end if;
  if exists(select 1 from public.subcontractor_change_orders where assignment_id=p_assignment_id)
     or exists(select 1 from public.subcontractor_payment_applications where assignment_id=p_assignment_id)
     or exists(select 1 from public.subcontractor_compliance_documents where assignment_id=p_assignment_id)
     or exists(select 1 from public.subcontractor_signature_events where assignment_id=p_assignment_id)
     or exists(select 1 from public.project_subcontract_work_authorizations where assignment_id=p_assignment_id)
     or exists(select 1 from public.trade_partner_messages where assignment_id=p_assignment_id) then
    raise exception 'This assignment has history and cannot be deleted. Use Remove, End, Terminate, or Replace instead';
  end if;
  delete from public.trade_partner_assignments where id=p_assignment_id;
end;
$$;

create or replace function public.close_trade_partner_access_when_project_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update public.trade_partner_assignments
    set assignment_status = 'archived',
        lifecycle_status = 'project_completed',
        lifecycle_reason = coalesce(lifecycle_reason, 'Project completed'),
        lifecycle_ended_at = coalesce(lifecycle_ended_at, now()),
        lifecycle_ended_by = coalesce(lifecycle_ended_by, auth.uid()),
        updated_by = coalesce(auth.uid(), updated_by),
        updated_at = now()
    where company_id = new.company_id
      and project_id = new.id
      and lifecycle_status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_close_trade_partner_access on public.projects;
create trigger projects_close_trade_partner_access
after update of status on public.projects
for each row execute function public.close_trade_partner_access_when_project_completed();

create or replace function public.get_my_trade_partner_jobs()
returns table(
  assignment_id uuid, project_id uuid, project_name text, project_status text,
  address_line_1 text, city text, state text, postal_code text,
  trade_name text, scope_of_work text, start_date date, target_completion_date date,
  assignment_status text, contract_status text
)
language sql
stable security definer
set search_path to 'public','pg_temp'
as $$
  select tpa.id,p.id,p.name,p.status,p.address_line_1,p.city,p.state,p.postal_code,
         tpa.trade_name,tpa.scope_of_work,tpa.start_date,tpa.target_completion_date,
         tpa.assignment_status,tpa.contract_status
  from public.company_memberships cm
  join public.trade_partner_assignments tpa
    on tpa.company_id=cm.company_id
   and tpa.vendor_id=cm.vendor_id
   and tpa.assignment_status='active'
   and tpa.lifecycle_status='active'
  join public.projects p on p.id=tpa.project_id and p.company_id=tpa.company_id and p.status <> 'completed'
  where cm.user_id=auth.uid()
    and cm.status='active'
    and lower(cm.role)='subcontractor'
    and cm.vendor_id is not null
  order by coalesce(tpa.start_date,current_date),p.name;
$$;

create or replace function public.bos_can_access_trade_partner_project(p_project_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable security definer
set search_path to 'public','pg_temp'
as $$
  select exists (
    select 1
    from public.company_memberships cm
    join public.trade_partner_assignments tpa
      on tpa.company_id = cm.company_id
     and tpa.vendor_id = cm.vendor_id
     and tpa.project_id = p_project_id
     and tpa.assignment_status = 'active'
     and tpa.lifecycle_status = 'active'
    join public.projects p on p.id=tpa.project_id and p.company_id=tpa.company_id and p.status <> 'completed'
    where cm.user_id = p_user_id
      and cm.status = 'active'
      and lower(cm.role) = 'subcontractor'
      and cm.vendor_id is not null
  );
$$;

create or replace function public.is_my_trade_partner_assignment(p_company_id uuid, p_assignment_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
 select exists(
   select 1
   from public.trade_partner_assignments a
   join public.company_memberships m
     on m.company_id=a.company_id
    and m.vendor_id=a.vendor_id
    and m.user_id=auth.uid()
    and m.status='active'
    and lower(m.role)='subcontractor'
   join public.projects p on p.id=a.project_id and p.company_id=a.company_id and p.status <> 'completed'
   where a.id=p_assignment_id
     and a.company_id=p_company_id
     and a.assignment_status='active'
     and a.lifecycle_status='active'
 );
$$;

grant execute on function public.manage_trade_partner_assignment_lifecycle(uuid,text,text,uuid,text) to authenticated;
grant execute on function public.submit_trade_partner_performance_review(uuid,integer,integer,integer,integer,integer,text) to authenticated;
grant execute on function public.delete_mistaken_trade_partner_assignment(uuid) to authenticated;
grant execute on function public.refresh_trade_partner_vendor_rating(uuid) to authenticated;

commit;
