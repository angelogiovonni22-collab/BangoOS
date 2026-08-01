begin;

alter table public.customers enable row level security;
alter table public.projects enable row level security;
alter table public.estimates enable row level security;
alter table public.invoices enable row level security;

-- Remove any existing legacy or conflicting policies on the target tables.
do $$
declare
  p record;
begin
  for p in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array['customers', 'projects', 'estimates', 'invoices'])
  loop
    execute format('drop policy if exists %I on public.%I;', p.policyname, p.tablename);
  end loop;
end $$;

create policy customers_select
on public.customers
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = customers.company_id
  )
);

create policy customers_insert
on public.customers
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = customers.company_id
  )
  and (
    customers.created_by is null
    or exists (
      select 1
      from public.profiles p_created
      where p_created.id = customers.created_by
        and p_created.company_id = customers.company_id
    )
  )
);

create policy customers_update
on public.customers
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = customers.company_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = customers.company_id
  )
  and (
    customers.created_by is null
    or exists (
      select 1
      from public.profiles p_created
      where p_created.id = customers.created_by
        and p_created.company_id = customers.company_id
    )
  )
);

create policy customers_delete
on public.customers
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = customers.company_id
  )
);

create policy projects_select
on public.projects
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = projects.company_id
  )
);

create policy projects_insert
on public.projects
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = projects.company_id
  )
  and (
    projects.customer_id is null
    or exists (
      select 1
      from public.customers c
      where c.id = projects.customer_id
        and c.company_id = projects.company_id
    )
  )
  and (
    projects.created_by is null
    or exists (
      select 1
      from public.profiles p_created
      where p_created.id = projects.created_by
        and p_created.company_id = projects.company_id
    )
  )
);

create policy projects_update
on public.projects
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = projects.company_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = projects.company_id
  )
  and (
    projects.customer_id is null
    or exists (
      select 1
      from public.customers c
      where c.id = projects.customer_id
        and c.company_id = projects.company_id
    )
  )
  and (
    projects.created_by is null
    or exists (
      select 1
      from public.profiles p_created
      where p_created.id = projects.created_by
        and p_created.company_id = projects.company_id
    )
  )
);

create policy projects_delete
on public.projects
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = projects.company_id
  )
);

create policy estimates_select
on public.estimates
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = estimates.company_id
  )
);

create policy estimates_insert
on public.estimates
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = estimates.company_id
  )
  and (
    estimates.customer_id is null
    or exists (
      select 1
      from public.customers c
      where c.id = estimates.customer_id
        and c.company_id = estimates.company_id
    )
  )
  and (
    estimates.project_id is null
    or exists (
      select 1
      from public.projects pr
      where pr.id = estimates.project_id
        and pr.company_id = estimates.company_id
    )
  )
  and (
    estimates.prepared_by is null
    or exists (
      select 1
      from public.profiles p_prepared
      where p_prepared.id = estimates.prepared_by
        and p_prepared.company_id = estimates.company_id
    )
  )
  and (
    estimates.created_by is null
    or exists (
      select 1
      from public.profiles p_created
      where p_created.id = estimates.created_by
        and p_created.company_id = estimates.company_id
    )
  )
  and (
    estimates.updated_by is null
    or exists (
      select 1
      from public.profiles p_updated
      where p_updated.id = estimates.updated_by
        and p_updated.company_id = estimates.company_id
    )
  )
);

create policy estimates_update
on public.estimates
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = estimates.company_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = estimates.company_id
  )
  and (
    estimates.customer_id is null
    or exists (
      select 1
      from public.customers c
      where c.id = estimates.customer_id
        and c.company_id = estimates.company_id
    )
  )
  and (
    estimates.project_id is null
    or exists (
      select 1
      from public.projects pr
      where pr.id = estimates.project_id
        and pr.company_id = estimates.company_id
    )
  )
  and (
    estimates.prepared_by is null
    or exists (
      select 1
      from public.profiles p_prepared
      where p_prepared.id = estimates.prepared_by
        and p_prepared.company_id = estimates.company_id
    )
  )
  and (
    estimates.created_by is null
    or exists (
      select 1
      from public.profiles p_created
      where p_created.id = estimates.created_by
        and p_created.company_id = estimates.company_id
    )
  )
  and (
    estimates.updated_by is null
    or exists (
      select 1
      from public.profiles p_updated
      where p_updated.id = estimates.updated_by
        and p_updated.company_id = estimates.company_id
    )
  )
);

-- No delete policy for estimates by design; archive/soft-delete is handled via updates.

create policy invoices_select
on public.invoices
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = invoices.company_id
  )
);

create policy invoices_insert
on public.invoices
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = invoices.company_id
  )
  and (
    invoices.customer_id is null
    or exists (
      select 1
      from public.customers c
      where c.id = invoices.customer_id
        and c.company_id = invoices.company_id
    )
  )
  and (
    invoices.project_id is null
    or exists (
      select 1
      from public.projects pr
      where pr.id = invoices.project_id
        and pr.company_id = invoices.company_id
    )
  )
  and (
    invoices.estimate_id is null
    or exists (
      select 1
      from public.estimates e
      where e.id = invoices.estimate_id
        and e.company_id = invoices.company_id
    )
  )
  and (
    invoices.prepared_by is null
    or exists (
      select 1
      from public.profiles p_prepared
      where p_prepared.id = invoices.prepared_by
        and p_prepared.company_id = invoices.company_id
    )
  )
  and (
    invoices.created_by is null
    or exists (
      select 1
      from public.profiles p_created
      where p_created.id = invoices.created_by
        and p_created.company_id = invoices.company_id
    )
  )
  and (
    invoices.updated_by is null
    or exists (
      select 1
      from public.profiles p_updated
      where p_updated.id = invoices.updated_by
        and p_updated.company_id = invoices.company_id
    )
  )
);

create policy invoices_update
on public.invoices
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = invoices.company_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = invoices.company_id
  )
  and (
    invoices.customer_id is null
    or exists (
      select 1
      from public.customers c
      where c.id = invoices.customer_id
        and c.company_id = invoices.company_id
    )
  )
  and (
    invoices.project_id is null
    or exists (
      select 1
      from public.projects pr
      where pr.id = invoices.project_id
        and pr.company_id = invoices.company_id
    )
  )
  and (
    invoices.estimate_id is null
    or exists (
      select 1
      from public.estimates e
      where e.id = invoices.estimate_id
        and e.company_id = invoices.company_id
    )
  )
  and (
    invoices.prepared_by is null
    or exists (
      select 1
      from public.profiles p_prepared
      where p_prepared.id = invoices.prepared_by
        and p_prepared.company_id = invoices.company_id
    )
  )
  and (
    invoices.created_by is null
    or exists (
      select 1
      from public.profiles p_created
      where p_created.id = invoices.created_by
        and p_created.company_id = invoices.company_id
    )
  )
  and (
    invoices.updated_by is null
    or exists (
      select 1
      from public.profiles p_updated
      where p_updated.id = invoices.updated_by
        and p_updated.company_id = invoices.company_id
    )
  )
);

create policy invoices_delete
on public.invoices
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = invoices.company_id
  )
);

commit;
