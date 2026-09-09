begin;

create or replace view public.bos_intelligence_usage_summary
with (security_invoker = true)
as
select
  company_id,
  product,
  count(*)::bigint as event_count,
  count(*) filter (where outcome = 'succeeded')::bigint as succeeded_count,
  count(*) filter (where outcome = 'provider_failed')::bigint as provider_failed_count,
  count(*) filter (where internal_non_billable)::bigint as internal_non_billable_count,
  count(*) filter (where metadata ->> 'providerCostStatus' = 'unpriced')::bigint as unpriced_event_count,
  coalesce(sum(input_units), 0)::bigint as input_units,
  coalesce(sum(output_units), 0)::bigint as output_units,
  coalesce(sum(total_units), 0)::bigint as total_units,
  coalesce(sum(provider_cost_micros), 0)::bigint as provider_cost_micros,
  max(created_at) as last_event_at
from public.bos_intelligence_usage_events
group by company_id, product;

create or replace view public.bos_intelligence_ledger_summary
with (security_invoker = true)
as
select
  company_id,
  product,
  coalesce(sum(case when entry_type = 'usage' then -credit_delta else 0 end), 0)::bigint as settled_credits_consumed,
  coalesce(sum(case when entry_type in ('allowance', 'purchase', 'refund') then credit_delta else 0 end), 0)::bigint as settled_credits_added,
  coalesce(sum(customer_charge_cents), 0)::bigint as customer_charge_cents,
  coalesce(sum(provider_cost_micros), 0)::bigint as provider_cost_micros,
  coalesce(sum(customer_charge_cents::bigint * 10000 - provider_cost_micros), 0)::bigint as margin_micros,
  count(*)::bigint as ledger_entry_count,
  max(created_at) as last_ledger_entry_at
from public.bos_intelligence_usage_ledger
group by company_id, product;

revoke all privileges on table public.bos_intelligence_usage_summary from anon;
revoke all privileges on table public.bos_intelligence_usage_summary from authenticated;
revoke all privileges on table public.bos_intelligence_usage_summary from service_role;
grant select on table public.bos_intelligence_usage_summary to authenticated;
grant select on table public.bos_intelligence_usage_summary to service_role;

revoke all privileges on table public.bos_intelligence_ledger_summary from anon;
revoke all privileges on table public.bos_intelligence_ledger_summary from authenticated;
revoke all privileges on table public.bos_intelligence_ledger_summary from service_role;
grant select on table public.bos_intelligence_ledger_summary to authenticated;
grant select on table public.bos_intelligence_ledger_summary to service_role;

comment on view public.bos_intelligence_usage_summary is
  'Tenant-scoped non-settling Orion and Blueprint Intelligence telemetry summary. security_invoker preserves underlying RLS.';
comment on view public.bos_intelligence_ledger_summary is
  'Tenant-scoped settled B.O.S. Intelligence accounting summary. No settlement is activated by this view.';

commit;
