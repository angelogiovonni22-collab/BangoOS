begin;

create or replace function public.bos_is_trade_partner_for_company(
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
      and lower(cm.role) = 'subcontractor'
      and cm.vendor_id is not null
  );
$$;

create or replace function public.bos_can_access_trade_partner_project(
  p_project_id uuid,
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
    join public.trade_partner_assignments tpa
      on tpa.company_id = cm.company_id
     and tpa.vendor_id = cm.vendor_id
     and tpa.project_id = p_project_id
     and tpa.assignment_status = 'active'
    where cm.user_id = p_user_id
      and cm.status = 'active'
      and lower(cm.role) = 'subcontractor'
      and cm.vendor_id is not null
  );
$$;

grant execute on function public.bos_is_trade_partner_for_company(uuid,uuid) to authenticated;
grant execute on function public.bos_can_access_trade_partner_project(uuid,uuid) to authenticated;

-- Trade partners may only see field-safe photos on projects assigned to their linked vendor.
drop policy if exists bos_trade_partner_project_photos_select_guard on public.project_photos;
create policy bos_trade_partner_project_photos_select_guard
on public.project_photos
as restrictive
for select
to authenticated
using (
  not public.bos_is_trade_partner_for_company(project_photos.company_id)
  or (
    public.bos_can_access_trade_partner_project(project_photos.project_id)
    and project_photos.category in ('before','progress','after','safety','damage','materials','inspection','other')
  )
);

drop policy if exists bos_trade_partner_project_photos_insert_guard on public.project_photos;
create policy bos_trade_partner_project_photos_insert_guard
on public.project_photos
as restrictive
for insert
to authenticated
with check (
  not public.bos_is_trade_partner_for_company(project_photos.company_id)
  or (
    public.bos_can_access_trade_partner_project(project_photos.project_id)
    and project_photos.uploaded_by = auth.uid()
    and project_photos.category in ('progress','safety','damage','materials','inspection','other')
  )
);

drop policy if exists bos_trade_partner_project_photos_update_guard on public.project_photos;
create policy bos_trade_partner_project_photos_update_guard
on public.project_photos
as restrictive
for update
to authenticated
using (
  not public.bos_is_trade_partner_for_company(project_photos.company_id)
  or (public.bos_can_access_trade_partner_project(project_photos.project_id) and project_photos.uploaded_by = auth.uid())
)
with check (
  not public.bos_is_trade_partner_for_company(project_photos.company_id)
  or (
    public.bos_can_access_trade_partner_project(project_photos.project_id)
    and project_photos.uploaded_by = auth.uid()
    and project_photos.category in ('progress','safety','damage','materials','inspection','other')
  )
);

drop policy if exists bos_trade_partner_project_photos_delete_guard on public.project_photos;
create policy bos_trade_partner_project_photos_delete_guard
on public.project_photos
as restrictive
for delete
to authenticated
using (
  not public.bos_is_trade_partner_for_company(project_photos.company_id)
  or (public.bos_can_access_trade_partner_project(project_photos.project_id) and project_photos.uploaded_by = auth.uid())
);

-- Storage keeps every other bucket unchanged, while project-photos is assignment scoped for trade partners.
drop policy if exists bos_trade_partner_project_photo_storage_select_guard on storage.objects;
create policy bos_trade_partner_project_photo_storage_select_guard
on storage.objects
as restrictive
for select
to authenticated
using (
  bucket_id <> 'project-photos'
  or not exists (
    select 1
    from public.company_memberships cm
    where cm.user_id = auth.uid() and cm.status = 'active' and lower(cm.role) = 'subcontractor'
  )
  or exists (
    select 1
    from public.project_photos pp
    where pp.storage_path = storage.objects.name
      and public.bos_can_access_trade_partner_project(pp.project_id)
      and pp.category in ('before','progress','after','safety','damage','materials','inspection','other')
  )
);

drop policy if exists bos_trade_partner_project_photo_storage_write_guard on storage.objects;
create policy bos_trade_partner_project_photo_storage_write_guard
on storage.objects
as restrictive
for insert
to authenticated
with check (
  bucket_id <> 'project-photos'
  or not exists (
    select 1 from public.company_memberships cm
    where cm.user_id = auth.uid() and cm.status = 'active' and lower(cm.role) = 'subcontractor'
  )
  or (
    split_part(storage.objects.name, '/', 2) ~* '^[0-9a-f-]{36}$'
    and public.bos_can_access_trade_partner_project(split_part(storage.objects.name, '/', 2)::uuid)
  )
);

-- Blueprints remain fully internal except approved revisions for an assigned trade-partner project.
drop policy if exists bos_trade_partner_blueprint_sets_guard on public.blueprint_sets;
create policy bos_trade_partner_blueprint_sets_guard
on public.blueprint_sets
as restrictive
for select
to authenticated
using (
  not public.bos_is_trade_partner_for_company(blueprint_sets.company_id)
  or public.bos_can_access_trade_partner_project(blueprint_sets.project_id)
);

drop policy if exists bos_trade_partner_blueprint_sheets_guard on public.blueprint_sheets;
create policy bos_trade_partner_blueprint_sheets_guard
on public.blueprint_sheets
as restrictive
for select
to authenticated
using (
  not public.bos_is_trade_partner_for_company(blueprint_sheets.company_id)
  or public.bos_can_access_trade_partner_project(blueprint_sheets.project_id)
);

drop policy if exists bos_trade_partner_blueprint_versions_guard on public.blueprint_versions;
create policy bos_trade_partner_blueprint_versions_guard
on public.blueprint_versions
as restrictive
for select
to authenticated
using (
  not public.bos_is_trade_partner_for_company(blueprint_versions.company_id)
  or (public.bos_can_access_trade_partner_project(blueprint_versions.project_id) and blueprint_versions.status = 'approved')
);

do $$
declare
  t text;
begin
  foreach t in array array['blueprint_sets','blueprint_sheets','blueprint_versions'] loop
    execute format('drop policy if exists %I on public.%I', 'bos_trade_partner_' || t || '_write_guard', t);
    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated with check (not public.bos_is_trade_partner_for_company(company_id))',
      'bos_trade_partner_' || t || '_write_guard', t
    );
  end loop;
end $$;

drop policy if exists bos_trade_partner_blueprint_storage_select_guard on storage.objects;
create policy bos_trade_partner_blueprint_storage_select_guard
on storage.objects
as restrictive
for select
to authenticated
using (
  bucket_id <> 'blueprints'
  or not exists (
    select 1 from public.company_memberships cm
    where cm.user_id = auth.uid() and cm.status = 'active' and lower(cm.role) = 'subcontractor'
  )
  or exists (
    select 1
    from public.blueprint_versions bv
    where bv.storage_path = storage.objects.name
      and bv.status = 'approved'
      and public.bos_can_access_trade_partner_project(bv.project_id)
  )
);

drop policy if exists bos_trade_partner_blueprint_storage_insert_guard on storage.objects;
create policy bos_trade_partner_blueprint_storage_insert_guard
on storage.objects
as restrictive
for insert
to authenticated
with check (
  bucket_id <> 'blueprints'
  or not exists (
    select 1 from public.company_memberships cm
    where cm.user_id = auth.uid() and cm.status = 'active' and lower(cm.role) = 'subcontractor'
  )
);

create table if not exists public.trade_partner_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  sender_user_id uuid not null references public.profiles(id) on delete restrict,
  sender_type text not null check (sender_type in ('internal','trade_partner')),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists trade_partner_messages_thread_idx
  on public.trade_partner_messages(company_id, project_id, vendor_id, created_at);

alter table public.trade_partner_messages enable row level security;

create policy trade_partner_messages_internal_select
on public.trade_partner_messages
for select
to authenticated
using (
  public.bos_role_has_permission(company_id, 'communications.view')
  and not public.bos_is_trade_partner_for_company(company_id)
);

create policy trade_partner_messages_partner_select
on public.trade_partner_messages
for select
to authenticated
using (
  public.bos_can_access_trade_partner_project(project_id)
  and exists (
    select 1 from public.company_memberships cm
    where cm.user_id = auth.uid()
      and cm.company_id = trade_partner_messages.company_id
      and cm.vendor_id = trade_partner_messages.vendor_id
      and cm.status = 'active'
      and lower(cm.role) = 'subcontractor'
  )
);

create policy trade_partner_messages_internal_insert
on public.trade_partner_messages
for insert
to authenticated
with check (
  public.bos_role_has_permission(company_id, 'communications.manage')
  and not public.bos_is_trade_partner_for_company(company_id)
  and sender_user_id = auth.uid()
  and sender_type = 'internal'
  and exists (
    select 1 from public.trade_partner_assignments tpa
    where tpa.company_id = trade_partner_messages.company_id
      and tpa.project_id = trade_partner_messages.project_id
      and tpa.vendor_id = trade_partner_messages.vendor_id
      and tpa.assignment_status = 'active'
  )
);

create policy trade_partner_messages_partner_insert
on public.trade_partner_messages
for insert
to authenticated
with check (
  sender_user_id = auth.uid()
  and sender_type = 'trade_partner'
  and public.bos_can_access_trade_partner_project(project_id)
  and exists (
    select 1 from public.company_memberships cm
    where cm.user_id = auth.uid()
      and cm.company_id = trade_partner_messages.company_id
      and cm.vendor_id = trade_partner_messages.vendor_id
      and cm.status = 'active'
      and lower(cm.role) = 'subcontractor'
  )
);

create or replace function public.get_my_trade_partner_photos(p_project_id uuid)
returns table(
  id uuid,
  storage_path text,
  original_filename text,
  mime_type text,
  category text,
  note text,
  captured_at timestamptz,
  created_at timestamptz,
  is_mine boolean
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select pp.id, pp.storage_path, pp.original_filename, pp.mime_type, pp.category, pp.note,
         pp.captured_at, pp.created_at, pp.uploaded_by = auth.uid()
  from public.project_photos pp
  where pp.project_id = p_project_id
    and public.bos_can_access_trade_partner_project(p_project_id)
    and pp.category in ('before','progress','after','safety','damage','materials','inspection','other')
  order by coalesce(pp.captured_at, pp.created_at) desc
  limit 120;
$$;

create or replace function public.get_my_trade_partner_plans(p_project_id uuid)
returns table(
  version_id uuid,
  sheet_number text,
  title text,
  discipline text,
  revision_label text,
  version_number integer,
  original_filename text,
  mime_type text,
  storage_path text,
  issued_at date
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select bv.id, bs.sheet_number, bs.title, bs.discipline, bv.revision_label, bv.version_number,
         bv.original_filename, bv.mime_type, bv.storage_path, bv.issued_at
  from public.blueprint_versions bv
  join public.blueprint_sheets bs on bs.id = bv.blueprint_sheet_id
  where bv.project_id = p_project_id
    and bv.status = 'approved'
    and public.bos_can_access_trade_partner_project(p_project_id)
    and not exists (
      select 1 from public.blueprint_versions newer
      where newer.blueprint_sheet_id = bv.blueprint_sheet_id
        and newer.status = 'approved'
        and newer.version_number > bv.version_number
    )
  order by bs.discipline, bs.sort_order, bs.sheet_number;
$$;

create or replace function public.get_my_trade_partner_messages(p_project_id uuid)
returns table(
  id uuid,
  body text,
  sender_type text,
  created_at timestamptz,
  is_mine boolean
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select m.id, m.body, m.sender_type, m.created_at, m.sender_user_id = auth.uid()
  from public.trade_partner_messages m
  join public.company_memberships cm
    on cm.company_id = m.company_id
   and cm.vendor_id = m.vendor_id
   and cm.user_id = auth.uid()
   and cm.status = 'active'
   and lower(cm.role) = 'subcontractor'
  where m.project_id = p_project_id
    and public.bos_can_access_trade_partner_project(p_project_id)
  order by m.created_at asc
  limit 250;
$$;

create or replace function public.send_my_trade_partner_message(p_project_id uuid, p_body text)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_vendor_id uuid;
  v_id uuid;
begin
  if char_length(btrim(coalesce(p_body,''))) not between 1 and 4000 then
    raise exception 'Message must contain between 1 and 4000 characters.' using errcode = '22023';
  end if;

  select cm.company_id, cm.vendor_id into v_company_id, v_vendor_id
  from public.company_memberships cm
  where cm.user_id = auth.uid()
    and cm.status = 'active'
    and lower(cm.role) = 'subcontractor'
    and cm.vendor_id is not null
    and public.bos_can_access_trade_partner_project(p_project_id)
  limit 1;

  if v_company_id is null then raise exception 'Trade partner project access denied.' using errcode = '42501'; end if;

  insert into public.trade_partner_messages(company_id, project_id, vendor_id, sender_user_id, sender_type, body)
  values(v_company_id, p_project_id, v_vendor_id, auth.uid(), 'trade_partner', btrim(p_body))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.register_my_trade_partner_photo(
  p_project_id uuid,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size bigint,
  p_category text default 'progress',
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_id uuid;
begin
  select cm.company_id into v_company_id
  from public.company_memberships cm
  where cm.user_id = auth.uid()
    and cm.status = 'active'
    and lower(cm.role) = 'subcontractor'
    and cm.vendor_id is not null
    and public.bos_can_access_trade_partner_project(p_project_id)
  limit 1;

  if v_company_id is null then raise exception 'Trade partner project access denied.' using errcode = '42501'; end if;
  if p_category not in ('progress','safety','damage','materials','inspection','other') then raise exception 'Photo category is not allowed.' using errcode = '22023'; end if;
  if p_mime_type not in ('image/jpeg','image/png','image/webp','image/heic') then raise exception 'Photo type is not allowed.' using errcode = '22023'; end if;
  if p_file_size < 1 or p_file_size > 10485760 then raise exception 'Photo must be 10 MB or smaller.' using errcode = '22023'; end if;
  if split_part(p_storage_path, '/', 1) <> v_company_id::text or split_part(p_storage_path, '/', 2) <> p_project_id::text then
    raise exception 'Photo storage path is invalid.' using errcode = '42501';
  end if;

  insert into public.project_photos(company_id, project_id, uploaded_by, storage_path, original_filename, mime_type, file_size, category, note, captured_at)
  values(v_company_id, p_project_id, auth.uid(), p_storage_path, nullif(btrim(p_original_filename),''), p_mime_type, p_file_size, p_category, nullif(btrim(p_note),''), now())
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.get_my_trade_partner_photos(uuid) to authenticated;
grant execute on function public.get_my_trade_partner_plans(uuid) to authenticated;
grant execute on function public.get_my_trade_partner_messages(uuid) to authenticated;
grant execute on function public.send_my_trade_partner_message(uuid,text) to authenticated;
grant execute on function public.register_my_trade_partner_photo(uuid,text,text,text,bigint,text,text) to authenticated;

commit;
