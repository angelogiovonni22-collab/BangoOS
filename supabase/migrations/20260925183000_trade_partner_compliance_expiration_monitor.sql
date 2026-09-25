begin;

create extension if not exists pg_cron;

create or replace function public.process_trade_partner_compliance_expirations()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc record;
  v_recipient record;
  v_days integer;
  v_bucket text;
  v_label text;
  v_count integer := 0;
begin
  update public.trade_partner_onboarding_documents
     set review_status = 'expired',
         updated_at = now()
   where status = 'active'
     and expires_at is not null
     and expires_at <= now()
     and review_status <> 'expired';

  for v_doc in
    select
      d.id,
      d.company_id,
      d.vendor_id,
      d.requirement_type,
      d.expires_at,
      d.review_status,
      greatest(-1, d.expires_at::date - current_date) as days_remaining
    from public.trade_partner_onboarding_documents d
    where d.status = 'active'
      and d.expires_at is not null
      and d.requirement_type in ('coi','workers_comp','licenses')
      and d.expires_at::date <= current_date + 30
  loop
    perform public.sync_trade_partner_company_compliance(
      v_doc.company_id,
      v_doc.vendor_id,
      v_doc.requirement_type
    );

    v_days := v_doc.days_remaining;
    v_bucket := case
      when v_days <= 0 then 'expired'
      when v_days <= 7 then '7-day'
      when v_days <= 14 then '14-day'
      else '30-day'
    end;
    v_label := case v_doc.requirement_type
      when 'coi' then 'Certificate of Insurance'
      when 'workers_comp' then 'Workers'' Compensation'
      when 'licenses' then 'License / Certification'
      else initcap(replace(v_doc.requirement_type, '_', ' '))
    end;

    if v_days <= 0 or v_days in (30,14,7) then
      for v_recipient in
        select m.user_id, 'partner'::text as recipient_kind
        from public.company_memberships m
        where m.company_id = v_doc.company_id
          and m.vendor_id = v_doc.vendor_id
          and m.status = 'active'
          and lower(m.role) = 'subcontractor'
        union all
        select m.user_id, 'internal'::text
        from public.company_memberships m
        where m.company_id = v_doc.company_id
          and m.status = 'active'
          and lower(m.role) in ('owner','administrator','office_manager','project_manager')
      loop
        insert into public.bos_notifications (
          company_id,
          recipient_user_id,
          category,
          severity,
          title,
          message,
          entity_type,
          entity_id,
          linked_href,
          source_module,
          source_key,
          requested_channels,
          delivery_state,
          in_app_status,
          push_status
        ) values (
          v_doc.company_id,
          v_recipient.user_id,
          'compliance',
          case when v_days <= 0 then 'critical' else 'warning' end,
          case when v_days <= 0 then v_label || ' expired' else v_label || ' expires soon' end,
          case
            when v_days <= 0 then v_label || ' has expired. B.O.S. has placed affected project mobilization on compliance hold until a current document is submitted and approved.'
            else v_label || ' expires in ' || v_days::text || ' days. Upload or obtain the renewal before expiration to prevent project access interruptions.'
          end,
          'trade_partner_compliance',
          v_doc.id,
          case when v_recipient.recipient_kind = 'partner' then '/partner' else '/trade-partners' end,
          'trade_partner_compliance',
          'trade-partner-compliance:' || v_doc.id::text || ':' || v_bucket || ':' || v_recipient.recipient_kind,
          array['in_app']::text[],
          'ready',
          'ready',
          'not_requested'
        )
        on conflict (company_id, recipient_user_id, source_key)
          where source_key is not null
        do nothing;

        if found then
          v_count := v_count + 1;
        end if;
      end loop;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.process_trade_partner_compliance_expirations() from public, anon, authenticated;
grant execute on function public.process_trade_partner_compliance_expirations() to service_role;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'trade-partner-compliance-expiration-sweep'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end;
$$;

select cron.schedule(
  'trade-partner-compliance-expiration-sweep',
  '15 12 * * *',
  'select public.process_trade_partner_compliance_expirations();'
);

select public.process_trade_partner_compliance_expirations();

commit;
