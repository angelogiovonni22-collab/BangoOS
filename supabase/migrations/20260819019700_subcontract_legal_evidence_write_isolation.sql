begin;

-- Legal subcontract snapshots, bearer-token hashes, and signature evidence are
-- written only by the authenticated server workflows that use service_role after
-- checking semantic project-management permission. Browser clients may read only
-- what their existing restrictive/permissive policies allow; they cannot rewrite
-- legal evidence directly through the Supabase data API.

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'subcontractor_master_agreements',
    'project_subcontract_work_authorizations',
    'subcontractor_signature_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', v_table);

    execute format('drop policy if exists bos_server_only_insert_guard on public.%I', v_table);
    execute format(
      'create policy bos_server_only_insert_guard on public.%I as restrictive for insert to authenticated with check (false)',
      v_table
    );

    execute format('drop policy if exists bos_server_only_update_guard on public.%I', v_table);
    execute format(
      'create policy bos_server_only_update_guard on public.%I as restrictive for update to authenticated using (false) with check (false)',
      v_table
    );

    execute format('drop policy if exists bos_server_only_delete_guard on public.%I', v_table);
    execute format(
      'create policy bos_server_only_delete_guard on public.%I as restrictive for delete to authenticated using (false)',
      v_table
    );
  end loop;
end $$;

commit;
