begin;

-- These non-SECURITY-DEFINER utility/trigger functions were flagged by the
-- Supabase security advisor because they inherited a caller-mutable search_path.
-- Pinning public + pg_temp preserves their current object resolution while
-- preventing a caller-controlled schema from changing what an unqualified name means.
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.normalize_company_slug(text) set search_path = public, pg_temp;
alter function public.company_role_weight(text) set search_path = public, pg_temp;
alter function public.trg_units_of_measure_validate_fn() set search_path = public, pg_temp;

commit;
