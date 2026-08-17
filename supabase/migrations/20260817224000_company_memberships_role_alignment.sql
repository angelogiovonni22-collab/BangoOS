begin;

-- Keep the membership role contract aligned with the role-aware B.O.S. app.
-- Older databases can retain a stale company_memberships_role_check even when
-- the current application and permission functions already support subcontractor.
alter table public.company_memberships
  drop constraint if exists company_memberships_role_check;

alter table public.company_memberships
  add constraint company_memberships_role_check
  check (
    role in (
      'owner',
      'administrator',
      'operations_manager',
      'project_manager',
      'estimator',
      'superintendent',
      'office_manager',
      'accountant',
      'foreman',
      'employee',
      'subcontractor',
      'customer'
    )
  );

commit;
