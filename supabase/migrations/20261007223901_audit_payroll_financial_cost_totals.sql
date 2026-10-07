begin;

-- Aggregate only recorded approved/exported payroll snapshots. Invoker security
-- preserves existing finance-only payroll access; other roles receive no wages.
create function public.get_payroll_job_cost_totals(p_company_id uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare
 l record; a jsonb; v_projects jsonb:='{}'; v_project_key text;
 v_gross numeric; v_hours numeric; v_line_gross numeric; v_line_hours numeric;
 v_ids uuid[]; v_all_ids uuid[]; v_line_ids uuid[];
 v_unassigned numeric:=0; v_unknown_gross numeric:=0; v_unknown_lines integer:=0;
 v_approved_gross numeric:=0; v_approved_lines integer:=0;
begin
 if not public.has_company_role(p_company_id,array['owner','administrator','office_manager']) then
   return jsonb_build_object('status','unavailable','reason','finance_role_required');
 end if;
 for l in select pl.* from public.payroll_lines pl join public.payroll_periods pp
   on pp.id=pl.payroll_period_id and pp.company_id=pl.company_id
   where pl.company_id=p_company_id and pp.status in ('approved','exported') order by pl.id
 loop
   v_approved_gross:=v_approved_gross+l.gross_pay; v_approved_lines:=v_approved_lines+1;
   if jsonb_typeof(l.project_allocations)<>'array' then
     v_unknown_lines:=v_unknown_lines+1; v_unknown_gross:=v_unknown_gross+l.gross_pay; continue;
   end if;
   if jsonb_array_length(l.project_allocations)=0
     or exists(select 1 from jsonb_array_elements(l.project_allocations) x
       where x->>'version' is distinct from '1' or x->>'allocation_method' is distinct from 'gross_pay_proportional_approved_hours_v1') then
     v_unknown_lines:=v_unknown_lines+1; v_unknown_gross:=v_unknown_gross+l.gross_pay; continue;
   end if;
   v_line_gross:=0; v_line_hours:=0; v_all_ids:='{}';
   -- Validate the entire line before exposing any of its project costs.
   for a in select value from jsonb_array_elements(l.project_allocations) loop
     if jsonb_typeof(a->'gross_pay') is distinct from 'number' or jsonb_typeof(a->'hours') is distinct from 'number'
       or jsonb_typeof(a->'source_time_entry_ids') is distinct from 'array'
       or jsonb_typeof(a->'source_time_entries') is distinct from 'array'
       or not (a ? 'project_id') then
       raise exception 'Payroll project cost snapshot is inconsistent';
     end if;
     v_gross:=(a->>'gross_pay')::numeric; v_hours:=(a->>'hours')::numeric;
     if v_gross<0 or v_hours<0 or v_gross<>round(v_gross,2) then raise exception 'Payroll project cost snapshot is inconsistent'; end if;
     if a->>'project_id' is not null and not exists(select 1 from public.projects p where p.id=(a->>'project_id')::uuid and p.company_id=p_company_id) then
       raise exception 'Payroll project cost snapshot belongs to an unavailable project';
     end if;
     select coalesce(array_agg(value::uuid order by value::uuid),'{}') into v_ids from jsonb_array_elements_text(a->'source_time_entry_ids');
     if cardinality(v_ids)=0 or v_ids is distinct from (select coalesce(array_agg((x->>'id')::uuid order by (x->>'id')::uuid),'{}') from jsonb_array_elements(a->'source_time_entries') x)
       or v_hours is distinct from (select sum((x->>'net_hours')::numeric) from jsonb_array_elements(a->'source_time_entries') x)
       or exists(select 1 from jsonb_array_elements(a->'source_time_entries') x where x->>'project_id' is distinct from a->>'project_id'
         or jsonb_typeof(x->'net_hours') is distinct from 'number' or (x->>'net_hours')::numeric<0) then
       raise exception 'Payroll source time snapshot is inconsistent';
     end if;
     v_all_ids:=v_all_ids||v_ids; v_line_gross:=v_line_gross+v_gross; v_line_hours:=v_line_hours+v_hours;
   end loop;
   select coalesce(array_agg(id order by id),'{}') into v_all_ids from unnest(v_all_ids) id;
   select coalesce(array_agg(id order by id),'{}') into v_line_ids from unnest(l.source_time_entry_ids) id;
   if v_all_ids is distinct from v_line_ids or v_line_gross<>l.gross_pay or round(v_line_hours,2)<>l.regular_hours+l.overtime_hours then
     raise exception 'Payroll project totals do not reconcile to recorded wages and time';
   end if;
   for a in select value from jsonb_array_elements(l.project_allocations) loop
     v_gross:=(a->>'gross_pay')::numeric; v_hours:=(a->>'hours')::numeric;
     if a->>'project_id' is null then v_unassigned:=v_unassigned+v_gross;
     else
       v_project_key:=a->>'project_id';
       v_projects:=jsonb_set(v_projects,array[v_project_key],jsonb_build_object('project_id',v_project_key,
         'gross_pay',coalesce((v_projects->v_project_key->>'gross_pay')::numeric,0)+v_gross,
         'hours',coalesce((v_projects->v_project_key->>'hours')::numeric,0)+v_hours));
     end if;
   end loop;
 end loop;
 return jsonb_build_object('status',case when v_unknown_lines>0 then 'partial' else 'available' end,
   'company_id',p_company_id,'projects',(select coalesce(jsonb_agg(value order by key),'[]') from jsonb_each(v_projects)),
   'unassigned_gross_pay',v_unassigned,'unknown_gross_pay',v_unknown_gross,'unknown_line_count',v_unknown_lines,
   'approved_gross_pay',v_approved_gross,'approved_line_count',v_approved_lines);
end $$;
revoke all on function public.get_payroll_job_cost_totals(uuid) from public,anon;
grant execute on function public.get_payroll_job_cost_totals(uuid) to authenticated;
commit;
