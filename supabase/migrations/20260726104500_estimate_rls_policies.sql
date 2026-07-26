begin;

alter table public.estimates enable row level security;
alter table public.estimate_sections enable row level security;
alter table public.estimate_items enable row level security;

drop policy if exists estimates_select on public.estimates;
drop policy if exists estimates_insert on public.estimates;
drop policy if exists estimates_update on public.estimates;
drop policy if exists estimates_delete on public.estimates;

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
    estimates.previous_estimate_id is null
    or exists (
      select 1
      from public.estimates pe
      where pe.id = estimates.previous_estimate_id
        and pe.company_id = estimates.company_id
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
  and (
    estimates.deleted_by is null
    or exists (
      select 1
      from public.profiles p_deleted
      where p_deleted.id = estimates.deleted_by
        and p_deleted.company_id = estimates.company_id
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
    estimates.previous_estimate_id is null
    or exists (
      select 1
      from public.estimates pe
      where pe.id = estimates.previous_estimate_id
        and pe.company_id = estimates.company_id
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
  and (
    estimates.deleted_by is null
    or exists (
      select 1
      from public.profiles p_deleted
      where p_deleted.id = estimates.deleted_by
        and p_deleted.company_id = estimates.company_id
    )
  )
);

-- No delete policy is created intentionally for estimates.
-- Application behavior is soft delete via update of deleted_at/deleted_by.

drop policy if exists estimate_sections_select on public.estimate_sections;
drop policy if exists estimate_sections_insert on public.estimate_sections;
drop policy if exists estimate_sections_update on public.estimate_sections;
drop policy if exists estimate_sections_delete on public.estimate_sections;

create policy estimate_sections_select
on public.estimate_sections
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = estimate_sections.company_id
  )
);

create policy estimate_sections_insert
on public.estimate_sections
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = estimate_sections.company_id
  )
  and exists (
    select 1
    from public.estimates e
    where e.id = estimate_sections.estimate_id
      and e.company_id = estimate_sections.company_id
      and e.deleted_at is null
  )
  and (
    estimate_sections.deleted_by is null
    or exists (
      select 1
      from public.profiles p_deleted
      where p_deleted.id = estimate_sections.deleted_by
        and p_deleted.company_id = estimate_sections.company_id
    )
  )
);

create policy estimate_sections_update
on public.estimate_sections
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = estimate_sections.company_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = estimate_sections.company_id
  )
  and exists (
    select 1
    from public.estimates e
    where e.id = estimate_sections.estimate_id
      and e.company_id = estimate_sections.company_id
      and (
        e.deleted_at is null
        or estimate_sections.deleted_at is not null
      )
  )
  and (
    estimate_sections.deleted_by is null
    or exists (
      select 1
      from public.profiles p_deleted
      where p_deleted.id = estimate_sections.deleted_by
        and p_deleted.company_id = estimate_sections.company_id
    )
  )
);

-- No delete policy is created intentionally for estimate_sections.

drop policy if exists estimate_items_select on public.estimate_items;
drop policy if exists estimate_items_insert on public.estimate_items;
drop policy if exists estimate_items_update on public.estimate_items;
drop policy if exists estimate_items_delete on public.estimate_items;

create policy estimate_items_select
on public.estimate_items
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = estimate_items.company_id
  )
);

create policy estimate_items_insert
on public.estimate_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = estimate_items.company_id
  )
  and exists (
    select 1
    from public.estimates e
    where e.id = estimate_items.estimate_id
      and e.company_id = estimate_items.company_id
      and e.deleted_at is null
  )
  and exists (
    select 1
    from public.estimate_sections s
    where s.id = estimate_items.section_id
      and s.estimate_id = estimate_items.estimate_id
      and s.company_id = estimate_items.company_id
      and s.deleted_at is null
  )
  and (
    estimate_items.converted_task_id is null
    or exists (
      select 1
      from public.tasks t
      where t.id = estimate_items.converted_task_id
        and t.company_id = estimate_items.company_id
    )
  )
  and (
    estimate_items.deleted_by is null
    or exists (
      select 1
      from public.profiles p_deleted
      where p_deleted.id = estimate_items.deleted_by
        and p_deleted.company_id = estimate_items.company_id
    )
  )
);

create policy estimate_items_update
on public.estimate_items
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = estimate_items.company_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = estimate_items.company_id
  )
  and exists (
    select 1
    from public.estimates e
    where e.id = estimate_items.estimate_id
      and e.company_id = estimate_items.company_id
      and (
        e.deleted_at is null
        or estimate_items.deleted_at is not null
      )
  )
  and exists (
    select 1
    from public.estimate_sections s
    where s.id = estimate_items.section_id
      and s.estimate_id = estimate_items.estimate_id
      and s.company_id = estimate_items.company_id
      and (
        s.deleted_at is null
        or estimate_items.deleted_at is not null
      )
  )
  and (
    estimate_items.converted_task_id is null
    or exists (
      select 1
      from public.tasks t
      where t.id = estimate_items.converted_task_id
        and t.company_id = estimate_items.company_id
    )
  )
  and (
    estimate_items.deleted_by is null
    or exists (
      select 1
      from public.profiles p_deleted
      where p_deleted.id = estimate_items.deleted_by
        and p_deleted.company_id = estimate_items.company_id
    )
  )
);

-- No delete policy is created intentionally for estimate_items.

commit;
