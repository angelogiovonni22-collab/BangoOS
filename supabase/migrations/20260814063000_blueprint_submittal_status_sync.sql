begin;
create or replace function public.recompute_blueprint_issue_status(p_annotation_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_status text;
begin
select case when count(*)=0 then null when bool_and(terminal) then 'resolved' else 'open' end into v_status from(
select t.status in('completed','cancelled') terminal from public.blueprint_operational_links l join public.tasks t on l.target_type='task' and t.id=l.target_id and t.company_id=l.company_id where l.annotation_id=p_annotation_id union all
select p.status in('completed','cancelled') from public.blueprint_operational_links l join public.project_punch_items p on l.target_type='punch_item' and p.id=l.target_id and p.company_id=l.company_id where l.annotation_id=p_annotation_id union all
select w.status in('completed','cancelled') from public.blueprint_operational_links l join public.workforce_assignments w on l.target_type='workforce_assignment' and w.id=l.target_id and w.company_id=l.company_id where l.annotation_id=p_annotation_id union all
select c.status in('approved','rejected','invoiced','void') from public.blueprint_operational_links l join public.change_orders c on l.target_type='change_order' and c.id=l.target_id and c.company_id=l.company_id where l.annotation_id=p_annotation_id union all
select r.status in('delivered','cancelled','logged_only') from public.blueprint_operational_links l join public.project_communications r on l.target_type='rfi' and r.id=l.target_id and r.company_id=l.company_id and r.channel='rfi' where l.annotation_id=p_annotation_id union all
select s.status in('approved','approved_as_noted','rejected','closed','void') from public.blueprint_operational_links l join public.project_submittals s on l.target_type='submittal' and s.id=l.target_id and s.company_id=l.company_id where l.annotation_id=p_annotation_id
) linked_records;
if v_status is not null then update public.blueprint_annotations set status=v_status,updated_at=now() where id=p_annotation_id and annotation_type='pin' and status is distinct from v_status;end if;
end;$$;
revoke all on function public.recompute_blueprint_issue_status(uuid) from public,anon,authenticated;
drop trigger if exists trg_submittal_to_blueprint_issue on public.project_submittals;
create trigger trg_submittal_to_blueprint_issue after update of status on public.project_submittals for each row execute function public.sync_blueprint_issue_from_operational_record('submittal');
commit;
