-- 1) RLS enabled status for target tables
select n.nspname as schema_name,
       c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('customers','projects','estimates','invoices')
order by c.relname;

-- 2) Policies currently present on target tables
select schemaname,
       tablename,
       policyname,
       cmd,
       qual,
       with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('customers','projects','estimates','invoices')
order by tablename, policyname;

-- 3) Any owner_id reference in policy expressions on target tables
select p.polname as policy_name,
       c.relname as table_name,
       coalesce(pg_get_expr(p.polqual, p.polrelid), '') as using_expr,
       coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') as with_check_expr
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('customers','projects','estimates','invoices')
  and (
    coalesce(pg_get_expr(p.polqual, p.polrelid), '') ilike '%owner_id%'
    or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ilike '%owner_id%'
    or coalesce(pg_get_expr(p.polqual, p.polrelid), '') ilike '%companies.%'
    or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ilike '%companies.%'
  )
order by c.relname, p.polname;

-- 4) Estimate DELETE policy count
select count(*)::int as estimates_delete_policy_count
from pg_policies
where schemaname = 'public'
  and tablename = 'estimates'
  and cmd = 'DELETE';
