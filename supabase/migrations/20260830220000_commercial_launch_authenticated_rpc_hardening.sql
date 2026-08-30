-- Commercial-launch hardening for internal SECURITY DEFINER routines.
-- Trigger functions and database-only helpers are never valid client RPCs.

revoke execute on function public.close_trade_partner_access_when_project_completed() from public, anon, authenticated;
revoke execute on function public.publish_blueprint_revision_ack_event() from public, anon, authenticated;
revoke execute on function public.publish_blueprint_revision_status_event() from public, anon, authenticated;
revoke execute on function public.trade_partner_review_rating_trigger() from public, anon, authenticated;
revoke execute on function public.trg_company_memberships_sync_profiles_fn() from public, anon, authenticated;
revoke execute on function public.trg_crew_memberships_validate_fn() from public, anon, authenticated;
revoke execute on function public.refresh_trade_partner_vendor_rating(uuid) from public, anon, authenticated;
revoke execute on function public.seed_default_system_units_of_measure() from public, anon, authenticated;

grant execute on function public.close_trade_partner_access_when_project_completed() to service_role;
grant execute on function public.publish_blueprint_revision_ack_event() to service_role;
grant execute on function public.publish_blueprint_revision_status_event() to service_role;
grant execute on function public.trade_partner_review_rating_trigger() to service_role;
grant execute on function public.trg_company_memberships_sync_profiles_fn() to service_role;
grant execute on function public.trg_crew_memberships_validate_fn() to service_role;
grant execute on function public.refresh_trade_partner_vendor_rating(uuid) to service_role;
grant execute on function public.seed_default_system_units_of_measure() to service_role;
