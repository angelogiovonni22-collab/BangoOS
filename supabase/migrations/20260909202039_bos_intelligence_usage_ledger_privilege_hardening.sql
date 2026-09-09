begin;

revoke all privileges on table public.bos_intelligence_usage_ledger from anon;
revoke all privileges on table public.bos_intelligence_usage_ledger from authenticated;
revoke all privileges on table public.bos_intelligence_usage_ledger from service_role;

grant select on table public.bos_intelligence_usage_ledger to authenticated;
grant select, insert on table public.bos_intelligence_usage_ledger to service_role;

commit;
