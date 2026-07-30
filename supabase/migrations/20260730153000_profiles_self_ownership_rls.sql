begin;

alter table public.profiles enable row level security;

-- Remove only known conflicting/obsolete profile policies.
drop policy if exists profiles_select_self on public.profiles;
drop policy if exists profiles_select_own_profile on public.profiles;
drop policy if exists profiles_insert_own_profile on public.profiles;
drop policy if exists profiles_update_own_profile on public.profiles;

create policy profiles_select_own_profile
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy profiles_insert_own_profile
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy profiles_update_own_profile
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

commit;
