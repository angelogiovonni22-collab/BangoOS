begin;

drop policy if exists profiles_select_self on public.profiles;

create policy profiles_select_self
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
);

commit;
