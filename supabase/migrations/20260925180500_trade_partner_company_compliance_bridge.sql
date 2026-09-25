begin;

-- Company-level Trade Partner compliance is submitted once and inherited by every
-- active project assignment. Project-specific requirements remain assignment scoped.
alter table public.trade_partner_onboarding_documents
  add column if not exists review_status text not null default 'pending',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists review_note text;

alter table public.trade_partner_onboarding_documents
  drop constraint if exists trade_partner_onboarding_documents_review_status_check,
  add constraint trade_partner_onboarding_documents_review_status_check
    check (review_status in ('pending','verified','rejected','expired'));

create index if not exists trade_partner_onboarding_documents_review_idx
  on public.trade_partner_onboarding_documents(company_id, vendor_id, requirement_type, status, review_status);

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
  v_doc record;
  v_status text;
  v_assignment record;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.has_company_role(p_company_id, array['owner','administrator','office_manager','project_manager'])
     and not exists (
       select 1
       from public.company_memberships m
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

    select d.*
      into v_doc
    from public.trade_partner_onboarding_documents d
    where d.company_id = p_company_id
      and d.vendor_id = p_vendor_id
      and d.requirement_type = v_type
      and d.status = 'active'
    order by d.created_at desc
    limit 1;

    if not found then
      v_status := 'missing';
    elsif v_doc.expires_at is not null and v_doc.expires_at <= now() then
      v_status := 'expired';
    elsif v_doc.review_status = 'verified' then
      v_status := 'verified';
    elsif v_doc.review_status = 'rejected' then
      v_status := 'missing';
    else
      v_status := 'pending';
    end if;

    update public.subcontractor_mobilization_requirements r
       set status = v_status,
           verified_at = case when v_status = 'verified' then v_doc.reviewed_at else null end,
           verified_by = case when v_status = 'verified' then v_doc.reviewed_by else null end,
           expires_at = case when found then v_doc.expires_at else null end,
           evidence = case when found then jsonb_build_object(
             'source','company_profile',
             'onboarding_document_id',v_doc.id,
             'original_filename',v_doc.original_filename,
             'review_status',v_doc.review_status,
             'review_note',v_doc.review_note
           ) else jsonb_build_object('source','company_profile') end,
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

create or replace function public.trade_partner_onboarding_document_sync_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;
  perform public.sync_trade_partner_company_compliance(
    coalesce(new.company_id, old.company_id),
    coalesce(new.vendor_id, old.vendor_id),
    coalesce(new.requirement_type, old.requirement_type)
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_trade_partner_onboarding_document_sync on public.trade_partner_onboarding_documents;
create trigger trg_trade_partner_onboarding_document_sync
after insert or update of status, review_status, expires_at on public.trade_partner_onboarding_documents
for each row execute function public.trade_partner_onboarding_document_sync_trigger();

create or replace function public.subcontractor_requirement_company_review_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if new.requirement_type not in ('w9','coi','workers_comp','licenses') then
    return new;
  end if;

  -- A project-level waiver is intentionally project-specific. A verification,
  -- however, approves the standing company document and should carry forward.
  if new.status = 'verified'
     and old.status is distinct from new.status
     and coalesce(new.evidence->>'source','') <> 'company_profile' then
    update public.trade_partner_onboarding_documents
       set review_status = 'verified',
           reviewed_at = coalesce(new.verified_at, now()),
           reviewed_by = new.verified_by,
           review_note = null,
           updated_at = now()
     where id = (
       select d.id
       from public.trade_partner_onboarding_documents d
       where d.company_id = new.company_id
         and d.vendor_id = new.vendor_id
         and d.requirement_type = new.requirement_type
         and d.status = 'active'
       order by d.created_at desc
       limit 1
     );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_subcontractor_requirement_company_review on public.subcontractor_mobilization_requirements;
create trigger trg_subcontractor_requirement_company_review
after update of status on public.subcontractor_mobilization_requirements
for each row execute function public.subcontractor_requirement_company_review_trigger();

-- When a new assignment creates company-level requirements, immediately inherit
-- any standing Trade Partner documents already on file.
create or replace function public.subcontractor_requirement_insert_sync_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  if new.requirement_type in ('w9','coi','workers_comp','licenses') then
    perform public.sync_trade_partner_company_compliance(new.company_id, new.vendor_id, new.requirement_type);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_subcontractor_requirement_insert_sync on public.subcontractor_mobilization_requirements;
create trigger trg_subcontractor_requirement_insert_sync
after insert on public.subcontractor_mobilization_requirements
for each row execute function public.subcontractor_requirement_insert_sync_trigger();

-- Backfill currently active assignments.
do $$
declare
  v record;
begin
  for v in
    select distinct company_id, vendor_id
    from public.subcontractor_mobilization_requirements
    where requirement_type in ('w9','coi','workers_comp','licenses')
  loop
    perform public.sync_trade_partner_company_compliance(v.company_id, v.vendor_id, null);
  end loop;
end;
$$;

commit;
