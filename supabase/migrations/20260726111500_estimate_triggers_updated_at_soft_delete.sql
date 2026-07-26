begin;

-- Reuse existing updated_at trigger function used by core tables.
-- Abort if no reusable function is found.
do $$
declare
  v_fn regprocedure;
begin
  select p.oid::regprocedure
    into v_fn
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  join pg_attribute a
    on a.attrelid = c.oid
   and a.attname = 'updated_at'
  where n.nspname = 'public'
    and c.relname in (
      'companies',
      'customers',
      'profiles',
      'projects',
      'estimates',
      'invoices',
      'project_phases',
      'tasks'
    )
    and not t.tgisinternal
  order by c.relname, t.tgname
  limit 1;

  if v_fn is null then
    raise exception
      'No existing updated_at trigger function found to reuse. Migration aborted to avoid creating duplicate function.';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'estimates'
      and t.tgname = 'trg_estimates_set_updated_at'
  ) then
    execute format(
      'create trigger trg_estimates_set_updated_at before update on public.estimates for each row execute function %s;',
      v_fn
    );
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'estimate_sections'
      and t.tgname = 'trg_estimate_sections_set_updated_at'
  ) then
    execute format(
      'create trigger trg_estimate_sections_set_updated_at before update on public.estimate_sections for each row execute function %s;',
      v_fn
    );
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'estimate_items'
      and t.tgname = 'trg_estimate_items_set_updated_at'
  ) then
    execute format(
      'create trigger trg_estimate_items_set_updated_at before update on public.estimate_items for each row execute function %s;',
      v_fn
    );
  end if;
end $$;

create or replace function public.trg_estimates_prevent_revision_cycle_fn()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_previous_company_id uuid;
  v_has_cycle boolean := false;
  v_company_lock_key bigint;
begin
  if new.previous_estimate_id is null then
    return new;
  end if;

  -- Serialize revision pointer updates within the same company for cycle safety.
  v_company_lock_key := ('x' || substr(replace(new.company_id::text, '-', ''), 1, 16))::bit(64)::bigint;
  perform pg_advisory_xact_lock(v_company_lock_key);

  if new.previous_estimate_id = new.id then
    raise exception 'previous_estimate_id cannot reference the same estimate row';
  end if;

  select e.company_id
    into v_previous_company_id
  from public.estimates e
  where e.id = new.previous_estimate_id;

  if v_previous_company_id is null then
    raise exception 'previous_estimate_id % does not exist', new.previous_estimate_id;
  end if;

  if v_previous_company_id <> new.company_id then
    raise exception 'previous_estimate_id must reference an estimate in the same company';
  end if;

  with recursive revision_chain as (
    select e.id, e.previous_estimate_id, 1 as depth
    from public.estimates e
    where e.id = new.previous_estimate_id

    union all

    select parent.id, parent.previous_estimate_id, rc.depth + 1
    from public.estimates parent
    join revision_chain rc
      on parent.id = rc.previous_estimate_id
    where rc.previous_estimate_id is not null
      and rc.depth < 200
  )
  select exists (
    select 1
    from revision_chain rc
    where rc.id = new.id
  )
    into v_has_cycle;

  if v_has_cycle then
    raise exception 'revision cycle detected for estimate %', new.id;
  end if;

  return new;
end;
$$;

create or replace function public.trg_estimates_soft_delete_cascade_fn()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    update public.estimate_sections s
       set deleted_at = new.deleted_at,
           deleted_by = new.deleted_by,
           updated_at = now()
     where s.estimate_id = new.id
       and s.deleted_at is null;

    update public.estimate_items i
       set deleted_at = new.deleted_at,
           deleted_by = new.deleted_by,
           updated_at = now()
     where i.estimate_id = new.id
       and i.deleted_at is null;
  elsif old.deleted_at is not null and new.deleted_at is null then
    -- Restore is estimate-only. Recalculate totals from currently active children.
    perform public.recalc_estimate_totals(new.id);
  end if;

  return new;
end;
$$;

create or replace function public.trg_estimate_sections_soft_delete_cascade_fn()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    update public.estimate_items i
       set deleted_at = new.deleted_at,
           deleted_by = new.deleted_by,
           updated_at = now()
     where i.section_id = new.id
       and i.deleted_at is null;
  end if;

  return new;
end;
$$;

create or replace function public.trg_estimate_items_recalc_fn()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.recalc_estimate_section_totals(old.section_id);
    perform public.recalc_estimate_totals(old.estimate_id);
    return old;
  end if;

  if tg_op = 'UPDATE' then
    -- Recalculate the new/current section first.
    perform public.recalc_estimate_item_fields(new.id);

    -- If the item moved sections, recalculate the old section to avoid stale totals.
    if old.section_id is distinct from new.section_id then
      perform public.recalc_estimate_section_totals(old.section_id);
    end if;

    -- Defensive: if an item moved across estimates, recalc the old estimate too.
    if old.estimate_id is distinct from new.estimate_id then
      perform public.recalc_estimate_totals(old.estimate_id);
    end if;

    return new;
  end if;

  perform public.recalc_estimate_item_fields(new.id);
  return new;
end;
$$;

create or replace function public.trg_estimate_sections_recalc_fn()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.recalc_estimate_totals(old.estimate_id);
    return old;
  end if;

  perform public.recalc_estimate_section_totals(new.id);
  perform public.recalc_estimate_totals(new.estimate_id);
  return new;
end;
$$;

create or replace function public.trg_estimates_recalc_fn()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  perform public.recalc_estimate_totals(new.id);
  return new;
end;
$$;

drop trigger if exists trg_estimates_soft_delete_cascade on public.estimates;
create trigger trg_estimates_soft_delete_cascade
after update of deleted_at, deleted_by
on public.estimates
for each row
when (old.deleted_at is distinct from new.deleted_at)
execute function public.trg_estimates_soft_delete_cascade_fn();

drop trigger if exists trg_estimate_sections_soft_delete_cascade on public.estimate_sections;
create trigger trg_estimate_sections_soft_delete_cascade
after update of deleted_at, deleted_by
on public.estimate_sections
for each row
when (old.deleted_at is distinct from new.deleted_at)
execute function public.trg_estimate_sections_soft_delete_cascade_fn();

drop trigger if exists trg_estimate_items_recalc on public.estimate_items;
create trigger trg_estimate_items_recalc
after insert or update or delete
on public.estimate_items
for each row
execute function public.trg_estimate_items_recalc_fn();

drop trigger if exists trg_estimate_sections_recalc on public.estimate_sections;
create trigger trg_estimate_sections_recalc
after insert or update or delete
on public.estimate_sections
for each row
execute function public.trg_estimate_sections_recalc_fn();

drop trigger if exists trg_estimates_recalc on public.estimates;
create trigger trg_estimates_recalc
after update of discount_type, discount_value, tax_rate
on public.estimates
for each row
execute function public.trg_estimates_recalc_fn();

drop trigger if exists trg_estimates_prevent_revision_cycle on public.estimates;
create trigger trg_estimates_prevent_revision_cycle
before insert or update of previous_estimate_id, company_id
on public.estimates
for each row
execute function public.trg_estimates_prevent_revision_cycle_fn();

revoke execute on function public.trg_estimates_prevent_revision_cycle_fn() from public;
revoke execute on function public.trg_estimates_soft_delete_cascade_fn() from public;
revoke execute on function public.trg_estimate_sections_soft_delete_cascade_fn() from public;
revoke execute on function public.trg_estimate_items_recalc_fn() from public;
revoke execute on function public.trg_estimate_sections_recalc_fn() from public;
revoke execute on function public.trg_estimates_recalc_fn() from public;

commit;
