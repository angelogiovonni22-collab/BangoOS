begin;

alter table public.blueprint_annotations replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'blueprint_annotations'
  ) then
    alter publication supabase_realtime add table public.blueprint_annotations;
  end if;
end
$$;

commit;
