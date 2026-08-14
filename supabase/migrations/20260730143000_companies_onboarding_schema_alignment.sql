begin;

alter table public.companies
  add column if not exists name text,
  add column if not exists legal_name text,
  add column if not exists display_name text,
  add column if not exists slug text,
  add column if not exists owner_id uuid,
  add column if not exists timezone text,
  add column if not exists status text not null default 'active',
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists country text,
  add column if not exists contractor_license text,
  add column if not exists insurance_provider text,
  add column if not exists years_in_business integer,
  add column if not exists default_tax_rate numeric(9,6),
  add column if not exists owner_name text,
  add column if not exists business_type text,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.companies
set
  name = coalesce(
    nullif(trim(name), ''),
    nullif(trim(display_name), ''),
    nullif(trim(legal_name), ''),
    'Company'
  ),
  country = coalesce(nullif(trim(country), ''), 'US'),
  timezone = coalesce(nullif(trim(timezone), ''), 'America/New_York'),
  status = coalesce(nullif(trim(status), ''), 'active'),
  onboarding_completed = coalesce(onboarding_completed, false),
  default_tax_rate = case
    when default_tax_rate is null then null
    when default_tax_rate > 1 and default_tax_rate <= 100 then round(default_tax_rate / 100.0, 6)
    else default_tax_rate
  end;

update public.companies
set onboarding_completed_at = coalesce(onboarding_completed_at, updated_at, created_at, now())
where onboarding_completed = true
  and onboarding_completed_at is null;

alter table public.companies
  alter column name set not null,
  alter column status set not null,
  alter column onboarding_completed set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

alter table public.companies
  drop constraint if exists companies_name_not_blank_check,
  add constraint companies_name_not_blank_check
    check (btrim(name) <> ''),
  drop constraint if exists companies_status_check,
  add constraint companies_status_check
    check (status in ('active', 'inactive', 'suspended', 'archived')),
  drop constraint if exists companies_business_type_check,
  add constraint companies_business_type_check
    check (business_type is null or business_type in ('residential', 'commercial', 'both')),
  drop constraint if exists companies_years_in_business_check,
  add constraint companies_years_in_business_check
    check (years_in_business is null or years_in_business >= 0),
  drop constraint if exists companies_default_tax_rate_check,
  add constraint companies_default_tax_rate_check
    check (default_tax_rate is null or (default_tax_rate >= 0 and default_tax_rate <= 1)),
  drop constraint if exists companies_onboarding_completed_at_check,
  add constraint companies_onboarding_completed_at_check
    check (onboarding_completed = false or onboarding_completed_at is not null);

create unique index if not exists idx_companies_slug_unique
  on public.companies (lower(slug));

create index if not exists idx_companies_owner_id
  on public.companies (owner_id);

create index if not exists idx_companies_created_by
  on public.companies (created_by);

create index if not exists idx_companies_updated_by
  on public.companies (updated_by);

create index if not exists idx_companies_onboarding_completed
  on public.companies (onboarding_completed);

do $$
declare
  v_constraint_name text;
begin
  for v_constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_attribute att
      on att.attrelid = rel.oid
     and att.attnum = any(con.conkey)
    where nsp.nspname = 'public'
      and rel.relname = 'companies'
      and con.contype = 'f'
      and att.attname = 'created_by'
  loop
    execute format('alter table public.companies drop constraint if exists %I', v_constraint_name);
  end loop;

  if not exists (
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'companies'
      and con.conname = 'companies_created_by_fkey'
  ) then
    alter table public.companies
      add constraint companies_created_by_fkey
      foreign key (created_by)
      references public.profiles(id)
      on delete set null
      not valid;
  end if;

  for v_constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_attribute att
      on att.attrelid = rel.oid
     and att.attnum = any(con.conkey)
    where nsp.nspname = 'public'
      and rel.relname = 'companies'
      and con.contype = 'f'
      and att.attname = 'updated_by'
  loop
    execute format('alter table public.companies drop constraint if exists %I', v_constraint_name);
  end loop;

  if not exists (
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'companies'
      and con.conname = 'companies_updated_by_fkey'
  ) then
    alter table public.companies
      add constraint companies_updated_by_fkey
      foreign key (updated_by)
      references public.profiles(id)
      on delete set null
      not valid;
  end if;
end $$;

do $$
declare
  v_updated_at_fn regprocedure;
begin
  select p.oid::regprocedure
    into v_updated_at_fn
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

  if v_updated_at_fn is null then
    raise exception
      'No existing updated_at trigger function found to reuse. Migration aborted to avoid creating duplicate function.';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'companies'
      and t.tgname = 'trg_companies_set_updated_at'
  ) then
    execute format(
      'create trigger trg_companies_set_updated_at before update on public.companies for each row execute function %s;',
      v_updated_at_fn
    );
  end if;
end $$;

commit;
