begin;

create or replace function public.get_payroll_workspace(p_company_id uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_result jsonb;
begin
  if not public.has_company_role(p_company_id,array['owner','administrator','office_manager']) then raise exception 'Not authorized'; end if;
  select jsonb_build_object(
    'employees',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'employee_number',e.employee_number,'name',coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),e.employee_number),'position_title',e.position_title,'employment_status',e.employment_status,'hourly_rate',s.hourly_rate,'overtime_multiplier',s.overtime_multiplier,'fringe_hourly',s.fringe_hourly,'provider',s.provider,'provider_employee_id',s.provider_employee_id,'payroll_ready',(s.id is not null and s.status='active')) order by e.employee_number) from public.employees e left join public.profiles p on p.id=e.profile_id left join public.payroll_employee_settings s on s.company_id=e.company_id and s.employee_id=e.id where e.company_id=p_company_id and e.employment_status='active'),'[]'::jsonb),
    'periods',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'period_start',x.period_start,'period_end',x.period_end,'pay_date',x.pay_date,'status',x.status,'regular_hours',x.regular_hours,'overtime_hours',x.overtime_hours,'regular_pay',x.regular_pay,'overtime_pay',x.overtime_pay,'fringe_pay',x.fringe_pay,'gross_pay',x.gross_pay,'approved_at',x.approved_at,'exported_at',x.exported_at) order by x.period_end desc) from (select * from public.payroll_periods where company_id=p_company_id order by period_end desc limit 20) x),'[]'::jsonb),
    'approved_unprocessed_hours',coalesce((select round(sum(greatest(0,extract(epoch from (t.ended_at-t.started_at))/3600.0-t.break_minutes/60.0))::numeric,2) from public.workforce_time_entries t where t.company_id=p_company_id and t.status='approved' and t.ended_at is not null and not exists(select 1 from public.payroll_lines l where l.company_id=p_company_id and t.id=any(l.source_time_entry_ids))),0),
    'employees_needing_rates',coalesce((select count(*) from public.employees e left join public.payroll_employee_settings s on s.company_id=e.company_id and s.employee_id=e.id and s.status='active' where e.company_id=p_company_id and e.employment_status='active' and s.id is null),0)
  ) into v_result;
  return v_result;
end $$;

create or replace function public.save_payroll_employee_setting(p_company_id uuid,p_employee_id uuid,p_hourly_rate numeric,p_overtime_multiplier numeric default 1.5,p_fringe_hourly numeric default 0,p_provider text default null,p_provider_employee_id text default null)
returns void language plpgsql security invoker set search_path=public as $$
begin
  if not public.has_company_role(p_company_id,array['owner','administrator','office_manager']) then raise exception 'Not authorized'; end if;
  if p_hourly_rate < 0 or p_overtime_multiplier < 1 or p_fringe_hourly < 0 then raise exception 'Invalid payroll rate'; end if;
  insert into public.payroll_employee_settings(company_id,employee_id,hourly_rate,overtime_multiplier,fringe_hourly,provider,provider_employee_id,status,created_by,updated_by)
  values(p_company_id,p_employee_id,p_hourly_rate,p_overtime_multiplier,p_fringe_hourly,nullif(btrim(p_provider),''),nullif(btrim(p_provider_employee_id),''),'active',auth.uid(),auth.uid())
  on conflict(company_id,employee_id) do update set hourly_rate=excluded.hourly_rate,overtime_multiplier=excluded.overtime_multiplier,fringe_hourly=excluded.fringe_hourly,provider=excluded.provider,provider_employee_id=excluded.provider_employee_id,status='active',updated_by=auth.uid(),updated_at=now();
end $$;

create or replace function public.get_payroll_period_detail(p_company_id uuid,p_period_id uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_result jsonb;
begin
 if not public.has_company_role(p_company_id,array['owner','administrator','office_manager']) then raise exception 'Not authorized'; end if;
 select jsonb_build_object('period',to_jsonb(p),'lines',coalesce((select jsonb_agg(to_jsonb(l) order by l.employee_name) from public.payroll_lines l where l.company_id=p_company_id and l.payroll_period_id=p_period_id),'[]'::jsonb)) into v_result from public.payroll_periods p where p.company_id=p_company_id and p.id=p_period_id;
 return v_result;
end $$;

grant execute on function public.get_payroll_workspace(uuid) to authenticated;
grant execute on function public.save_payroll_employee_setting(uuid,uuid,numeric,numeric,numeric,text,text) to authenticated;
grant execute on function public.get_payroll_period_detail(uuid,uuid) to authenticated;
commit;