begin;

create table public.record_attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entity_type text not null check (entity_type in ('customer', 'estimate', 'invoice', 'project')),
  entity_id uuid not null,
  storage_path text not null unique check (btrim(storage_path) <> ''),
  uploaded_by uuid references public.profiles(id) on delete set null,
  caption text,
  sort_order integer not null default 0 check (sort_order >= 0),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')),
  file_size_bytes bigint not null check (file_size_bytes between 1 and 10485760),
  original_filename text not null check (btrim(original_filename) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index record_attachments_entity_idx on public.record_attachments(company_id, entity_type, entity_id, sort_order);
alter table public.record_attachments enable row level security;

create or replace function public.record_attachment_entity_belongs_to_company(kind text, record_id uuid, tenant_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case kind
    when 'customer' then exists(select 1 from public.customers where id = record_id and company_id = tenant_id)
    when 'estimate' then exists(select 1 from public.estimates where id = record_id and company_id = tenant_id)
    when 'invoice' then exists(select 1 from public.invoices where id = record_id and company_id = tenant_id)
    when 'project' then exists(select 1 from public.projects where id = record_id and company_id = tenant_id)
    else false
  end;
$$;

create policy record_attachments_select on public.record_attachments for select to authenticated using (
  exists(select 1 from public.profiles where id = auth.uid() and company_id = record_attachments.company_id)
);
create policy record_attachments_insert on public.record_attachments for insert to authenticated with check (
  exists(select 1 from public.profiles where id = auth.uid() and company_id = record_attachments.company_id)
  and public.record_attachment_entity_belongs_to_company(entity_type, entity_id, company_id)
  and uploaded_by = auth.uid()
);
create policy record_attachments_update on public.record_attachments for update to authenticated
using (exists(select 1 from public.profiles where id = auth.uid() and company_id = record_attachments.company_id))
with check (exists(select 1 from public.profiles where id = auth.uid() and company_id = record_attachments.company_id) and public.record_attachment_entity_belongs_to_company(entity_type, entity_id, company_id));
create policy record_attachments_delete on public.record_attachments for delete to authenticated using (
  exists(select 1 from public.profiles where id = auth.uid() and company_id = record_attachments.company_id)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('record-attachments', 'record-attachments', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy record_attachments_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'record-attachments'
  and exists(select 1 from public.profiles where id = auth.uid() and company_id::text = (storage.foldername(name))[1])
  and (storage.foldername(name))[2] in ('customer','estimate','invoice','project')
);
create policy record_attachments_storage_select on storage.objects for select to authenticated using (
  bucket_id = 'record-attachments' and exists(select 1 from public.record_attachments a join public.profiles p on p.id = auth.uid() where a.storage_path = name and p.company_id = a.company_id)
);
create policy record_attachments_storage_delete on storage.objects for delete to authenticated using (
  bucket_id = 'record-attachments'
  and exists(select 1 from public.profiles where id = auth.uid() and company_id::text = (storage.foldername(name))[1])
);

do $$ declare v_fn regprocedure; begin
  select p.oid::regprocedure into v_fn from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid where n.nspname='public' and c.relname='customers' and not t.tgisinternal limit 1;
  if v_fn is not null then execute format('create trigger trg_record_attachments_updated_at before update on public.record_attachments for each row execute function %s;', v_fn); end if;
end $$;

commit;
