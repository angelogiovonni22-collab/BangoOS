begin;

-- ---------------------------------------------------------------------------
-- Internal least-privilege RLS
--
-- Company tenancy alone is not authorization. Historical policies on a number of
-- sensitive tables allowed any same-company profile/member to read or mutate data,
-- while the application UI attempted to hide those modules by role. Add restrictive
-- policies so bypassing a page/API cannot expose customer, contract, financial,
-- workforce, blueprint, photo, or project data beyond the semantic B.O.S.
-- permission model. Service-role server workflows continue to bypass RLS.
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  read_policy text;
  insert_policy text;
  update_policy text;
  delete_policy text;
begin
  for r in
    select * from (values
      -- Core customer / project records.
      ('customers', 'customers.view', 'customers.manage'),
      ('projects', 'projects.view', 'projects.manage'),
      ('project_deletion_history', 'projects.manage', 'projects.manage'),

      -- Estimate, signature, public-link and contract-compliance evidence.
      ('estimates', 'estimates.view', 'estimates.manage'),
      ('estimate_items', 'estimates.view', 'estimates.manage'),
      ('estimate_sections', 'estimates.view', 'estimates.manage'),
      ('estimate_line_items', 'estimates.view', 'estimates.manage'),
      ('estimate_agreement_versions', 'estimates.view', 'estimates.manage'),
      ('estimate_signatures', 'estimates.view', 'estimates.manage'),
      ('estimate_acceptance_events', 'estimates.view', 'estimates.manage'),
      ('estimate_public_tokens', 'estimates.view', 'estimates.manage'),
      ('estimate_project_conversions', 'estimates.view', 'estimates.manage'),
      ('estimate_contract_compliance_profiles', 'estimates.view', 'estimates.manage'),
      ('estimate_contract_compliance_evaluations', 'estimates.view', 'estimates.manage'),
      ('estimate_contract_verifications', 'estimates.view', 'estimates.manage'),
      ('estimate_home_solicitation_profiles', 'estimates.view', 'estimates.manage'),
      ('estimate_home_solicitation_events', 'estimates.view', 'estimates.manage'),
      ('estimate_home_solicitation_cancellations', 'estimates.view', 'estimates.manage'),
      ('compliance_counsel_reviews', 'estimates.view', 'estimates.manage'),

      -- Receivables/payables and payment evidence.
      ('invoices', 'invoices.view', 'invoices.manage'),
      ('invoice_line_items', 'invoices.view', 'invoices.manage'),
      ('invoice_notes', 'invoices.view', 'invoices.manage'),
      ('invoice_payment_history', 'invoices.view', 'invoices.manage'),
      ('invoice_estimate_links', 'invoices.view', 'invoices.manage'),
      ('invoice_payment_compliance_evaluations', 'invoices.view', 'invoices.manage'),
      ('vendor_bills', 'invoices.view', 'invoices.manage'),
      ('vendor_bill_line_items', 'invoices.view', 'invoices.manage'),
      ('vendor_bill_payments', 'invoices.view', 'invoices.manage'),

      -- Change-order financial/work authorization records.
      ('change_orders', 'change_orders.view', 'change_orders.manage'),
      ('change_order_line_items', 'change_orders.view', 'change_orders.manage'),
      ('change_order_notes', 'change_orders.view', 'change_orders.manage'),
      ('change_order_activity', 'change_orders.view', 'change_orders.manage'),
      ('change_order_invoice_links', 'change_orders.view', 'change_orders.manage'),
      ('change_order_excess_cost_compliance_evaluations', 'change_orders.view', 'change_orders.manage'),

      ('labor_rates', 'labor_rates.view', 'labor_rates.manage'),
      ('vendors', 'vendors.view', 'vendors.manage'),

      -- Workforce master data. Time-entry/field tables are intentionally excluded;
      -- they have employee/self-service workflows that need narrower row predicates.
      ('employees', 'workforce.view', 'workforce.manage'),
      ('crews', 'workforce.view', 'workforce.manage'),
      ('crew_memberships', 'workforce.view', 'workforce.manage'),

      ('equipment', 'equipment.view', 'equipment.manage'),

      -- Material catalog/procurement master records with clear module ownership.
      ('materials', 'materials.view', 'materials.manage'),
      ('purchase_orders', 'materials.view', 'materials.manage'),
      ('purchase_order_line_items', 'materials.view', 'materials.manage'),
      ('purchase_order_receipts', 'materials.view', 'materials.manage'),
      ('project_material_allocations', 'materials.view', 'materials.manage'),

      -- Blueprints and job photos. Existing partner-specific restrictive policies
      -- remain in force; subcontractor/customer feature permissions cannot escape
      -- the portal-only boundary added by the external isolation migration.
      ('blueprint_sets', 'blueprints.view', 'blueprints.manage'),
      ('blueprint_sheets', 'blueprints.view', 'blueprints.manage'),
      ('blueprint_versions', 'blueprints.view', 'blueprints.manage'),
      ('blueprint_annotations', 'blueprints.view', 'blueprints.manage'),
      ('blueprint_layers', 'blueprints.view', 'blueprints.manage'),
      ('blueprint_media_attachments', 'blueprints.view', 'blueprints.manage'),
      ('blueprint_operational_links', 'blueprints.view', 'blueprints.manage'),
      ('blueprint_plan_packages', 'blueprints.view', 'blueprints.manage'),
      ('blueprint_revision_acknowledgments', 'blueprints.view', 'blueprints.manage'),
      ('blueprint_spatial_scans', 'blueprints.view', 'blueprints.manage'),
      ('blueprint_model_schedule_links', 'blueprints.view', 'blueprints.manage'),
      ('project_photos', 'photos.view', 'photos.manage'),

      ('project_communications', 'communications.view', 'communications.manage'),

      -- Subcontract legal/compliance records are internal project-management data;
      -- public signing uses service-role token workflows instead of direct RLS access.
      ('subcontractor_master_agreements', 'projects.manage', 'projects.manage'),
      ('project_subcontract_work_authorizations', 'projects.manage', 'projects.manage'),
      ('subcontractor_signature_events', 'projects.manage', 'projects.manage'),
      ('subcontractor_mobilization_requirements', 'projects.manage', 'projects.manage'),
      ('subcontractor_compliance_documents', 'projects.manage', 'projects.manage')
    ) as x(table_name, read_permission, write_permission)
  loop
    if to_regclass('public.' || r.table_name) is null then
      continue;
    end if;

    -- Only company-scoped RLS tables belong in this generic guard.
    if not exists (
      select 1
      from pg_attribute a
      where a.attrelid = to_regclass('public.' || r.table_name)
        and a.attname = 'company_id'
        and not a.attisdropped
    ) then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', r.table_name);

    read_policy := 'bos_internal_permission_select_guard';
    insert_policy := 'bos_internal_permission_insert_guard';
    update_policy := 'bos_internal_permission_update_guard';
    delete_policy := 'bos_internal_permission_delete_guard';

    execute format('drop policy if exists %I on public.%I', read_policy, r.table_name);
    execute format(
      'create policy %I on public.%I as restrictive for select to authenticated using (public.bos_role_has_permission(company_id, %L))',
      read_policy, r.table_name, r.read_permission
    );

    execute format('drop policy if exists %I on public.%I', insert_policy, r.table_name);
    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated with check (public.bos_role_has_permission(company_id, %L))',
      insert_policy, r.table_name, r.write_permission
    );

    execute format('drop policy if exists %I on public.%I', update_policy, r.table_name);
    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated using (public.bos_role_has_permission(company_id, %L)) with check (public.bos_role_has_permission(company_id, %L))',
      update_policy, r.table_name, r.write_permission, r.write_permission
    );

    execute format('drop policy if exists %I on public.%I', delete_policy, r.table_name);
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated using (public.bos_role_has_permission(company_id, %L))',
      delete_policy, r.table_name, r.write_permission
    );
  end loop;
end $$;

commit;
