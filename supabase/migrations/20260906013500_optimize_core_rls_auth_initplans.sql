-- Commercial-launch RLS performance hardening.
-- Preserve existing authorization semantics while allowing Postgres to cache
-- stable auth.uid() results once per statement via an initPlan.

alter policy "workflow_events_insert"
  on public.workflow_events
  with check (
    has_company_role(
      company_id,
      array[
        'owner'::text,
        'administrator'::text,
        'operations_manager'::text,
        'project_manager'::text,
        'superintendent'::text,
        'foreman'::text,
        'office_manager'::text
      ]
    )
    and (actor_profile_id is null or actor_profile_id = (select auth.uid()))
  );

alter policy "profiles_insert_own_profile"
  on public.profiles
  with check (id = (select auth.uid()));

alter policy "profiles_select_own_profile"
  on public.profiles
  using (id = (select auth.uid()));

alter policy "profiles_update_own_profile"
  on public.profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy "units_of_measure_insert"
  on public.units_of_measure
  with check (
    is_system = false
    and company_id is not null
    and has_company_role(
      company_id,
      array[
        'owner'::text,
        'administrator'::text,
        'operations_manager'::text,
        'office_manager'::text,
        'accountant'::text,
        'estimator'::text
      ]
    )
    and (created_by is null or created_by = (select auth.uid()))
    and (updated_by is null or updated_by = (select auth.uid()))
  );

alter policy "units_of_measure_update"
  on public.units_of_measure
  using (
    is_system = false
    and has_company_role(
      company_id,
      array[
        'owner'::text,
        'administrator'::text,
        'operations_manager'::text,
        'office_manager'::text,
        'accountant'::text,
        'estimator'::text
      ]
    )
  )
  with check (
    is_system = false
    and has_company_role(
      company_id,
      array[
        'owner'::text,
        'administrator'::text,
        'operations_manager'::text,
        'office_manager'::text,
        'accountant'::text,
        'estimator'::text
      ]
    )
    and (updated_by is null or updated_by = (select auth.uid()))
  );
