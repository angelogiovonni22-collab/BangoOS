begin;

create table if not exists public.subcontractor_compliance_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  assignment_id uuid not null references public.trade_partner_assignments(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  requirement_type text not null check (requirement_type in ('w9','coi','workers_comp','licenses','safety_acknowledgement')),
  storage_path text not null unique check (btrim(storage_path) <> ''),
  original_filename text not null check (btrim(original_filename) <> ''),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  file_size_bytes bigint not null check (file_size_bytes between 1 and 20971520),
  expires_at timestamptz,
  status text not null default 'active' check (status in ('active','superseded','deleted')),
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subcontractor_compliance_documents_assignment_idx
  on public.subcontractor_compliance_documents(company_id, assignment_id, requirement_type, created_at desc);

alter table public.subcontractor_compliance_documents enable row level security;

create policy subcontractor_compliance_documents_select on public.subcontractor_compliance_documents
for select to authenticated using (
  exists(select 1 from public.profiles where id = auth.uid() and company_id = subcontractor_compliance_documents.company_id)
);
create policy subcontractor_compliance_documents_insert on public.subcontractor_compliance_documents
for insert to authenticated with check (
  exists(select 1 from public.profiles where id = auth.uid() and company_id = subcontractor_compliance_documents.company_id)
  and uploaded_by = auth.uid()
  and exists(select 1 from public.trade_partner_assignments a where a.id = assignment_id and a.company_id = company_id and a.project_id = project_id and a.vendor_id = vendor_id)
);
create policy subcontractor_compliance_documents_update on public.subcontractor_compliance_documents
for update to authenticated using (
  exists(select 1 from public.profiles where id = auth.uid() and company_id = subcontractor_compliance_documents.company_id)
) with check (
  exists(select 1 from public.profiles where id = auth.uid() and company_id = subcontractor_compliance_documents.company_id)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'subcontractor-compliance',
  'subcontractor-compliance',
  false,
  20971520,
  array['application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy subcontractor_compliance_storage_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'subcontractor-compliance'
  and exists(select 1 from public.profiles where id = auth.uid() and company_id::text = (storage.foldername(name))[1])
);
create policy subcontractor_compliance_storage_select on storage.objects
for select to authenticated using (
  bucket_id = 'subcontractor-compliance'
  and exists(
    select 1
    from public.subcontractor_compliance_documents d
    join public.profiles p on p.id = auth.uid()
    where d.storage_path = name and p.company_id = d.company_id and d.status = 'active'
  )
);
create policy subcontractor_compliance_storage_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'subcontractor-compliance'
  and exists(select 1 from public.profiles where id = auth.uid() and company_id::text = (storage.foldername(name))[1])
);

commit;
