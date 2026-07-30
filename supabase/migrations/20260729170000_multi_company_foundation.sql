begin;

alter table public.companies
  add column if not exists legal_name text,
  add column if not exists display_name text,
  add column if not exists slug text,
  add column if not exists country text,
  add column if not exists timezone text,
  add column if not exists status text not null default 'active',
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.companies
  alter column display_name set default null,
  alter column legal_name set default null,
  alter column slug set default null;

alter table public.companies
  drop constraint if exists companies_status_check,
  add constraint companies_status_check
    check (status in ('active', 'inactive', 'suspended', 'archived'));

create or replace function public.normalize_company_slug(input_value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(input_value, '')), '[^a-z0-9]+', '-', 'g'))
$$;

update public.companies
set
  legal_name = coalesce(nullif(trim(legal_name), ''), nullif(trim(name), '')),
  display_name = coalesce(nullif(trim(display_name), ''), nullif(trim(name), '')),
  timezone = coalesce(nullif(trim(timezone), ''), 'America/New_York'),
  country = coalesce(nullif(trim(country), ''), 'US')
where
  legal_name is null
  or display_name is null
  or timezone is null
  or country is null;

with base as (
  select
    c.id,
    case
      when public.normalize_company_slug(c.slug) <> '' then public.normalize_company_slug(c.slug)
      when public.normalize_company_slug(c.display_name) <> '' then public.normalize_company_slug(c.display_name)
      when public.normalize_company_slug(c.legal_name) <> '' then public.normalize_company_slug(c.legal_name)
      else 'company'
    end as base_slug
  from public.companies c
), ranked as (
  select
    b.id,
    b.base_slug,
    row_number() over (partition by b.base_slug order by b.id) as slug_rank
  from base b
)
update public.companies c
set slug = case
  when r.slug_rank = 1 then r.base_slug
  else r.base_slug || '-' || r.slug_rank::text
end
from ranked r
where c.id = r.id
  and (c.slug is null or trim(c.slug) = '');

create unique index if not exists idx_companies_slug_unique
  on public.companies (lower(slug));

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  display_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'employee',
  status text not null default 'active',
  is_primary boolean not null default false,
  invited_by uuid null references auth.users(id) on delete set null,
  joined_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint company_memberships_company_user_unique unique (company_id, user_id),
  constraint company_memberships_role_check check (
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
  ),
  constraint company_memberships_status_check check (
    status in ('invited', 'active', 'inactive', 'suspended', 'revoked')
  )
);

create index if not exists idx_company_memberships_company_status
  on public.company_memberships (company_id, status);

create index if not exists idx_company_memberships_user_status
  on public.company_memberships (user_id, status);

create index if not exists idx_company_memberships_company_role
  on public.company_memberships (company_id, role);

create unique index if not exists idx_company_memberships_primary_active_user
  on public.company_memberships (user_id)
  where is_primary = true and status = 'active';

create or replace function public.company_role_weight(input_role text)
returns integer
language sql
immutable
as $$
  select case lower(coalesce(input_role, ''))
    when 'owner' then 120
    when 'administrator' then 110
    when 'operations_manager' then 100
    when 'project_manager' then 90
    when 'office_manager' then 80
    when 'accountant' then 70
    when 'estimator' then 60
    when 'superintendent' then 50
    when 'foreman' then 40
    when 'employee' then 30
    when 'subcontractor' then 20
    when 'customer' then 10
    else 0
  end
$$;

create or replace function public.is_company_member(
  p_company_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.company_memberships cm
    where cm.company_id = p_company_id
      and cm.user_id = p_user_id
      and cm.status = 'active'
  )
  or exists (
    select 1
    from public.companies c
    where c.id = p_company_id
      and c.owner_id = p_user_id
  )
$$;

create or replace function public.has_company_role(
  p_company_id uuid,
  p_roles text[],
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.company_memberships cm
    where cm.company_id = p_company_id
      and cm.user_id = p_user_id
      and cm.status = 'active'
      and lower(cm.role) = any (
        select lower(role_name)
        from unnest(coalesce(p_roles, array[]::text[])) as role_name
      )
  )
  or (
    'owner' = any (
      select lower(role_name)
      from unnest(coalesce(p_roles, array[]::text[])) as role_name
    )
    and exists (
      select 1
      from public.companies c
      where c.id = p_company_id
        and c.owner_id = p_user_id
    )
  )
$$;

insert into public.user_profiles (id, first_name, last_name, display_name, phone)
select
  p.id,
  p.first_name,
  p.last_name,
  nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
  p.phone
from public.profiles p
on conflict (id) do update
set
  first_name = coalesce(excluded.first_name, public.user_profiles.first_name),
  last_name = coalesce(excluded.last_name, public.user_profiles.last_name),
  display_name = coalesce(excluded.display_name, public.user_profiles.display_name),
  phone = coalesce(excluded.phone, public.user_profiles.phone),
  updated_at = now();

insert into public.company_memberships (company_id, user_id, role, status, is_primary, joined_at)
select
  p.company_id,
  p.id,
  coalesce(nullif(trim(p.role), ''), 'employee'),
  'active',
  true,
  coalesce(p.created_at, now())
from public.profiles p
where p.company_id is not null
on conflict (company_id, user_id) do update
set
  role = excluded.role,
  status = 'active',
  joined_at = coalesce(public.company_memberships.joined_at, excluded.joined_at),
  updated_at = now();

insert into public.company_memberships (company_id, user_id, role, status, is_primary, joined_at)
select
  c.id,
  c.owner_id,
  'owner',
  'active',
  true,
  coalesce(c.created_at, now())
from public.companies c
where c.owner_id is not null
on conflict (company_id, user_id) do update
set
  role = 'owner',
  status = 'active',
  is_primary = true,
  joined_at = coalesce(public.company_memberships.joined_at, excluded.joined_at),
  updated_at = now();

with ranked as (
  select
    cm.id,
    row_number() over (
      partition by cm.user_id
      order by
        case when cm.status = 'active' then 0 else 1 end,
        case when lower(cm.role) = 'owner' then 0 else 1 end,
        public.company_role_weight(cm.role) desc,
        coalesce(cm.joined_at, cm.created_at) asc,
        cm.created_at asc,
        cm.id asc
    ) as rank_order
  from public.company_memberships cm
)
update public.company_memberships cm
set is_primary = (ranked.rank_order = 1),
    updated_at = now()
from ranked
where cm.id = ranked.id
  and cm.is_primary is distinct from (ranked.rank_order = 1);

update public.profiles p
set
  company_id = cm.company_id,
  role = cm.role,
  updated_at = now()
from public.company_memberships cm
where cm.user_id = p.id
  and cm.is_primary = true
  and cm.status = 'active'
  and (
    p.company_id is distinct from cm.company_id
    or p.role is distinct from cm.role
  );

create or replace function public.trg_company_memberships_sync_profiles_fn()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_primary_company_id uuid;
  v_primary_role text;
begin
  select cm.company_id, cm.role
    into v_primary_company_id, v_primary_role
  from public.company_memberships cm
  where cm.user_id = coalesce(new.user_id, old.user_id)
    and cm.status = 'active'
  order by
    case when cm.is_primary then 0 else 1 end,
    public.company_role_weight(cm.role) desc,
    coalesce(cm.joined_at, cm.created_at) asc,
    cm.created_at asc
  limit 1;

  if v_primary_company_id is null then
    update public.profiles
       set company_id = null,
           role = coalesce(role, 'employee'),
           updated_at = now()
     where id = coalesce(new.user_id, old.user_id);
    return coalesce(new, old);
  end if;

  update public.profiles
     set company_id = v_primary_company_id,
         role = v_primary_role,
         updated_at = now()
   where id = coalesce(new.user_id, old.user_id)
     and (
       company_id is distinct from v_primary_company_id
       or role is distinct from v_primary_role
     );

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_company_memberships_sync_profiles
  on public.company_memberships;

create trigger trg_company_memberships_sync_profiles
after insert or update or delete on public.company_memberships
for each row execute function public.trg_company_memberships_sync_profiles_fn();

alter table public.companies enable row level security;
alter table public.user_profiles enable row level security;
alter table public.company_memberships enable row level security;

drop policy if exists companies_select_members on public.companies;
drop policy if exists companies_insert_members on public.companies;
drop policy if exists companies_update_members on public.companies;
drop policy if exists companies_delete_members on public.companies;

create policy companies_select_members
on public.companies
for select
to authenticated
using (
  public.is_company_member(companies.id)
);

create policy companies_insert_members
on public.companies
for insert
to authenticated
with check (
  auth.uid() is not null
  and (companies.owner_id is null or companies.owner_id = auth.uid())
  and (companies.created_by is null or companies.created_by = auth.uid())
);

create policy companies_update_members
on public.companies
for update
to authenticated
using (
  public.has_company_role(companies.id, array['owner', 'administrator'])
)
with check (
  public.has_company_role(companies.id, array['owner', 'administrator'])
);

create policy companies_delete_members
on public.companies
for delete
to authenticated
using (
  public.has_company_role(companies.id, array['owner'])
);

drop policy if exists user_profiles_select_self_or_shared on public.user_profiles;
drop policy if exists user_profiles_insert_self on public.user_profiles;
drop policy if exists user_profiles_update_self on public.user_profiles;
drop policy if exists user_profiles_delete_self on public.user_profiles;

create policy user_profiles_select_self_or_shared
on public.user_profiles
for select
to authenticated
using (
  user_profiles.id = auth.uid()
  or exists (
    select 1
    from public.company_memberships viewer
    join public.company_memberships subject
      on subject.company_id = viewer.company_id
    where viewer.user_id = auth.uid()
      and viewer.status = 'active'
      and subject.user_id = user_profiles.id
      and subject.status = 'active'
  )
);

create policy user_profiles_insert_self
on public.user_profiles
for insert
to authenticated
with check (user_profiles.id = auth.uid());

create policy user_profiles_update_self
on public.user_profiles
for update
to authenticated
using (user_profiles.id = auth.uid())
with check (user_profiles.id = auth.uid());

create policy user_profiles_delete_self
on public.user_profiles
for delete
to authenticated
using (user_profiles.id = auth.uid());

drop policy if exists company_memberships_select_members on public.company_memberships;
drop policy if exists company_memberships_insert_admin on public.company_memberships;
drop policy if exists company_memberships_update_admin on public.company_memberships;
drop policy if exists company_memberships_delete_admin on public.company_memberships;

create policy company_memberships_select_members
on public.company_memberships
for select
to authenticated
using (
  company_memberships.user_id = auth.uid()
  or public.is_company_member(company_memberships.company_id)
);

create policy company_memberships_insert_admin
on public.company_memberships
for insert
to authenticated
with check (
  public.has_company_role(company_memberships.company_id, array['owner', 'administrator'])
  or (
    company_memberships.user_id = auth.uid()
    and lower(company_memberships.role) = 'owner'
    and exists (
      select 1
      from public.companies c
      where c.id = company_memberships.company_id
        and c.owner_id = auth.uid()
    )
  )
);

create policy company_memberships_update_admin
on public.company_memberships
for update
to authenticated
using (
  public.has_company_role(company_memberships.company_id, array['owner', 'administrator'])
)
with check (
  public.has_company_role(company_memberships.company_id, array['owner', 'administrator'])
);

create policy company_memberships_delete_admin
on public.company_memberships
for delete
to authenticated
using (
  public.has_company_role(company_memberships.company_id, array['owner', 'administrator'])
);

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
    raise exception 'No updated_at trigger function found to reuse.';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'user_profiles'
      and t.tgname = 'trg_user_profiles_set_updated_at'
  ) then
    execute format(
      'create trigger trg_user_profiles_set_updated_at before update on public.user_profiles for each row execute function %s;',
      v_updated_at_fn
    );
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'company_memberships'
      and t.tgname = 'trg_company_memberships_set_updated_at'
  ) then
    execute format(
      'create trigger trg_company_memberships_set_updated_at before update on public.company_memberships for each row execute function %s;',
      v_updated_at_fn
    );
  end if;
end $$;

grant execute on function public.is_company_member(uuid, uuid) to authenticated;
grant execute on function public.has_company_role(uuid, text[], uuid) to authenticated;

commit;
