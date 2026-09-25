begin;

create or replace function public.sync_trade_partner_company_compliance(
  p_company_id uuid,
  p_vendor_id uuid,
  p_requirement_type text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_doc_id uuid;
  v_filename text;
  v_expires_at timestamptz;
  v_review_status text;
  v_reviewed_at timestamptz;
  v_reviewed_by uuid;
  v_review_note text;
  v_status text;
  v_assignment record;
begin
  if auth.uid() is not null
     and coalesce(auth.role(), '') <> 'service_role'
     and not public.has_company_role(p_company_id, array['owner','administrator','office_manager','project_manager'])
     and not exists (
       select 1 from public.company_memberships m
       where m.user_id = auth.uid()
         and m.company_id = p_company_id
         and m.vendor_id = p_vendor_id
         and m.status = 'active'
         and lower(m.role) = 'subcontractor'
     ) then
    raise exception 'Unauthorized Trade Partner compliance access';
  end if;

  foreach v_type in array array['w9','coi','workers_comp','licenses']
  loop
    if p_requirement_type is not null and v_type <> p_requirement_type then
      continue;
    end if;

    v_doc_id := null;
    v_filename := null;
    v_expires_at := null;
    v_review_status := null;
    v_reviewed_at := null;
    v_reviewed_by := null;
    v_review_note := null;

    select d.id, d.original_filename, d.expires_at, d.review_status, d.reviewed_at, d.reviewed_by, d.review_note
      into v_doc_id, v_filename, v_expires_at, v_review_status, v_reviewed_at, v_reviewed_by, v_review_note
    from public.trade_partner_onboarding_documents d
    where d.company_id = p_company_id
      and d.vendor_id = p_vendor_id
      and d.requirement_type = v_type
      and d.status = 'active'
    order by d.created_at desc
    limit 1;

    if v_doc_id is null then
      v_status := 'missing';
    elsif v_expires_at is not null and v_expires_at <= now() then
      v_status := 'expired';
    elsif v_review_status = 'verified' then
      v_status := 'verified';
    elsif v_review_status = 'rejected' then
      v_status := 'missing';
    else
      v_status := 'pending';
    end if;

    update public.subcontractor_mobilization_requirements r
       set status = v_status,
           verified_at = case when v_status = 'verified' then v_reviewed_at else null end,
           verified_by = case when v_status = 'verified' then v_reviewed_by else null end,
           expires_at = v_expires_at,
           evidence = case
             when v_doc_id is null then jsonb_build_object('source','company_profile')
             else jsonb_build_object(
               'source','company_profile',
               'onboarding_document_id',v_doc_id,
               'original_filename',v_filename,
               'review_status',v_review_status,
               'review_note',v_review_note
             )
           end,
           updated_at = now()
     where r.company_id = p_company_id
       and r.vendor_id = p_vendor_id
       and r.requirement_type = v_type
       and r.required = true
       and exists (
         select 1 from public.trade_partner_assignments a
         where a.id = r.assignment_id
           and a.company_id = p_company_id
           and a.assignment_status <> 'archived'
       );

    for v_assignment in
      select distinct r.assignment_id
      from public.subcontractor_mobilization_requirements r
      where r.company_id = p_company_id
        and r.vendor_id = p_vendor_id
        and r.requirement_type = v_type
    loop
      perform public.refresh_subcontractor_mobilization_status(p_company_id, v_assignment.assignment_id);
    end loop;
  end loop;
end;
$$;

revoke all on function public.sync_trade_partner_company_compliance(uuid, uuid, text) from public, anon;
grant execute on function public.sync_trade_partner_company_compliance(uuid, uuid, text) to authenticated, service_role;

commit;
