begin;

-- Keep the legacy profiles.role mirror compatible with the canonical
-- company_memberships role model. company_memberships remains the source of
-- truth for authorization; profiles is maintained by the existing sync trigger.
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
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
