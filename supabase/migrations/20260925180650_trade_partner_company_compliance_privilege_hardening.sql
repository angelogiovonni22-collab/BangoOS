begin;

revoke all on function public.trade_partner_onboarding_document_sync_trigger() from public, anon, authenticated;
revoke all on function public.subcontractor_requirement_company_review_trigger() from public, anon, authenticated;
revoke all on function public.subcontractor_requirement_insert_sync_trigger() from public, anon, authenticated;

revoke all on function public.sync_trade_partner_company_compliance(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.sync_trade_partner_company_compliance(uuid, uuid, text) to service_role;

commit;
