begin;

create table if not exists public.project_receipts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  uploaded_by uuid null references public.profiles(id) on delete set null,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  file_size bigint not null default 0,
  file_sha256 text not null,
  vendor_name text null,
  receipt_number text null,
  purchased_at date null,
  subtotal numeric(14,2) null,
  tax_amount numeric(14,2) null,
  total_amount numeric(14,2) null,
  currency_code text not null default 'USD',
  payment_method text null,
  status text not null default 'processing',
  extraction_confidence numeric(5,4) null,
  extraction_payload jsonb not null default '{}'::jsonb,
  duplicate_of uuid null references public.project_receipts(id) on delete set null,
  approved_by uuid null references public.profiles(id) on delete set null,
  approved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_receipts_storage_path_not_blank check (btrim(storage_path) <> ''),
  constraint project_receipts_filename_not_blank check (btrim(original_filename) <> ''),
  constraint project_receipts_sha256_format check (file_sha256 ~ '^[0-9a-f]{64}$'),
  constraint project_receipts_file_size_check check (file_size >= 0 and file_size <= 20971520),
  constraint project_receipts_status_check check (status in ('processing','needs_review','approved','rejected','failed')),
  constraint project_receipts_currency_check check (currency_code ~ '^[A-Z]{3}$'),
  constraint project_receipts_money_check check (
    (subtotal is null or subtotal >= 0)
    and (tax_amount is null or tax_amount >= 0)
    and (total_amount is null or total_amount >= 0)
  ),
  constraint project_receipts_confidence_check check (extraction_confidence is null or (extraction_confidence >= 0 and extraction_confidence <= 1)),
  constraint project_receipts_approval_check check (
    (status = 'approved' and approved_at is not null)
    or status <> 'approved'
  )
);

create table if not exists public.project_receipt_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  receipt_id uuid not null references public.project_receipts(id) on delete cascade,
  description text not null,
  quantity numeric(14,3) not null default 1,
  unit_price numeric(14,2) null,
  line_total numeric(14,2) not null default 0,
  category text not null default 'materials',
  cost_code_id uuid null references public.cost_codes(id) on delete set null,
  extraction_confidence numeric(5,4) null,
  created_at timestamptz not null default now(),
  constraint project_receipt_items_description_not_blank check (btrim(description) <> ''),
  constraint project_receipt_items_quantity_check check (quantity > 0),
  constraint project_receipt_items_money_check check ((unit_price is null or unit_price >= 0) and line_total >= 0),
  constraint project_receipt_items_category_check check (category in ('materials','tools','equipment','safety','consumables','tax','other')),
  constraint project_receipt_items_confidence_check check (extraction_confidence is null or (extraction_confidence >= 0 and extraction_confidence <= 1))
);

create index if not exists idx_project_receipts_company_project on public.project_receipts(company_id, project_id, created_at desc);
create index if not exists idx_project_receipts_status on public.project_receipts(company_id, project_id, status);
create index if not exists idx_project_receipts_vendor_date on public.project_receipts(company_id, lower(vendor_name), purchased_at);
create unique index if not exists idx_project_receipts_company_file_sha256_unique on public.project_receipts(company_id, file_sha256) where status <> 'rejected';
create unique index if not exists idx_project_receipts_storage_path_unique on public.project_receipts(storage_path);
create index if not exists idx_project_receipt_items_receipt on public.project_receipt_items(receipt_id);
create index if not exists idx_project_receipt_items_project on public.project_receipt_items(company_id, project_id);
create index if not exists idx_project_receipt_items_cost_code on public.project_receipt_items(cost_code_id) where cost_code_id is not null;

alter table public.project_receipts enable row level security;
alter table public.project_receipt_items enable row level security;

drop policy if exists project_receipts_select on public.project_receipts;
drop policy if exists project_receipts_insert on public.project_receipts;
drop policy if exists project_receipts_update on public.project_receipts;
drop policy if exists project_receipts_delete on public.project_receipts;

create policy project_receipts_select on public.project_receipts
for select to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.company_id = project_receipts.company_id)
  and exists (select 1 from public.projects pr where pr.id = project_receipts.project_id and pr.company_id = project_receipts.company_id)
);

create policy project_receipts_insert on public.project_receipts
for insert to authenticated
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.company_id = project_receipts.company_id)
  and exists (select 1 from public.projects pr where pr.id = project_receipts.project_id and pr.company_id = project_receipts.company_id)
  and (project_receipts.uploaded_by is null or project_receipts.uploaded_by = auth.uid())
);

create policy project_receipts_update on public.project_receipts
for update to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.company_id = project_receipts.company_id)
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.company_id = project_receipts.company_id)
  and exists (select 1 from public.projects pr where pr.id = project_receipts.project_id and pr.company_id = project_receipts.company_id)
);

create policy project_receipts_delete on public.project_receipts
for delete to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.company_id = project_receipts.company_id
      and p.role in ('owner','administrator','operations_manager','project_manager','office_manager','accountant')
  )
);

drop policy if exists project_receipt_items_select on public.project_receipt_items;
drop policy if exists project_receipt_items_insert on public.project_receipt_items;
drop policy if exists project_receipt_items_update on public.project_receipt_items;
drop policy if exists project_receipt_items_delete on public.project_receipt_items;

create policy project_receipt_items_select on public.project_receipt_items
for select to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.company_id = project_receipt_items.company_id)
  and exists (
    select 1 from public.project_receipts r
    where r.id = project_receipt_items.receipt_id
      and r.company_id = project_receipt_items.company_id
      and r.project_id = project_receipt_items.project_id
  )
);

create policy project_receipt_items_insert on public.project_receipt_items
for insert to authenticated
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.company_id = project_receipt_items.company_id)
  and exists (
    select 1 from public.project_receipts r
    where r.id = project_receipt_items.receipt_id
      and r.company_id = project_receipt_items.company_id
      and r.project_id = project_receipt_items.project_id
  )
);

create policy project_receipt_items_update on public.project_receipt_items
for update to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.company_id = project_receipt_items.company_id))
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.company_id = project_receipt_items.company_id)
  and exists (
    select 1 from public.project_receipts r
    where r.id = project_receipt_items.receipt_id
      and r.company_id = project_receipt_items.company_id
      and r.project_id = project_receipt_items.project_id
  )
);

create policy project_receipt_items_delete on public.project_receipt_items
for delete to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.company_id = project_receipt_items.company_id));

create trigger project_receipts_set_updated_at
before update on public.project_receipts
for each row execute function public.set_updated_at();

create or replace function public.finalize_project_receipt(
  p_receipt_id uuid,
  p_vendor_name text,
  p_receipt_number text,
  p_purchased_at date,
  p_subtotal numeric,
  p_tax_amount numeric,
  p_total_amount numeric,
  p_payment_method text,
  p_items jsonb default '[]'::jsonb
)
returns table(receipt_id uuid, status text, approved_at timestamptz)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_receipt public.project_receipts%rowtype;
  v_profile public.profiles%rowtype;
  v_item jsonb;
  v_description text;
  v_quantity numeric;
  v_unit_price numeric;
  v_line_total numeric;
  v_category text;
  v_cost_code_id uuid;
begin
  if p_total_amount is null or p_total_amount < 0 then
    raise exception 'Receipt total must be zero or greater.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Receipt items must be a JSON array.';
  end if;

  select * into v_receipt
  from public.project_receipts r
  where r.id = p_receipt_id
  for update;

  if not found then
    raise exception 'Receipt not found.';
  end if;

  select * into v_profile
  from public.profiles p
  where p.id = auth.uid()
    and p.company_id = v_receipt.company_id;

  if not found then
    raise exception 'Unauthorized.';
  end if;

  if v_receipt.status = 'rejected' then
    raise exception 'Rejected receipts cannot be approved.';
  end if;

  update public.project_receipts
  set vendor_name = nullif(btrim(coalesce(p_vendor_name, '')), ''),
      receipt_number = nullif(btrim(coalesce(p_receipt_number, '')), ''),
      purchased_at = p_purchased_at,
      subtotal = p_subtotal,
      tax_amount = p_tax_amount,
      total_amount = p_total_amount,
      payment_method = nullif(btrim(coalesce(p_payment_method, '')), ''),
      status = 'approved',
      approved_by = auth.uid(),
      approved_at = now()
  where id = p_receipt_id;

  delete from public.project_receipt_items where receipt_id = p_receipt_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_description := nullif(btrim(coalesce(v_item->>'description', '')), '');
    if v_description is null then
      continue;
    end if;

    v_quantity := greatest(coalesce(nullif(v_item->>'quantity', '')::numeric, 1), 0.001);
    v_unit_price := nullif(v_item->>'unit_price', '')::numeric;
    v_line_total := greatest(coalesce(nullif(v_item->>'line_total', '')::numeric, coalesce(v_unit_price, 0) * v_quantity, 0), 0);
    v_category := coalesce(nullif(v_item->>'category', ''), 'materials');
    if v_category not in ('materials','tools','equipment','safety','consumables','tax','other') then
      v_category := 'other';
    end if;
    v_cost_code_id := nullif(v_item->>'cost_code_id', '')::uuid;

    insert into public.project_receipt_items (
      company_id, project_id, receipt_id, description, quantity, unit_price, line_total, category, cost_code_id, extraction_confidence
    ) values (
      v_receipt.company_id,
      v_receipt.project_id,
      p_receipt_id,
      v_description,
      v_quantity,
      v_unit_price,
      v_line_total,
      v_category,
      v_cost_code_id,
      case when (v_item->>'confidence') ~ '^[0-9]+(\.[0-9]+)?$' then least(greatest((v_item->>'confidence')::numeric, 0), 1) else null end
    );
  end loop;

  return query
  select r.id, r.status, r.approved_at
  from public.project_receipts r
  where r.id = p_receipt_id;
end;
$$;

grant execute on function public.finalize_project_receipt(uuid,text,text,date,numeric,numeric,numeric,text,jsonb) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-receipts',
  'project-receipts',
  false,
  20971520,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists project_receipts_storage_select on storage.objects;
drop policy if exists project_receipts_storage_insert on storage.objects;
drop policy if exists project_receipts_storage_update on storage.objects;
drop policy if exists project_receipts_storage_delete on storage.objects;

create policy project_receipts_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'project-receipts'
  and exists (
    select 1
    from public.project_receipts r
    join public.profiles p on p.id = auth.uid() and p.company_id = r.company_id
    where r.storage_path = storage.objects.name
  )
);

create policy project_receipts_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'project-receipts'
  and split_part(storage.objects.name, '/', 1) ~* '^[0-9a-f-]{36}$'
  and split_part(storage.objects.name, '/', 2) ~* '^[0-9a-f-]{36}$'
  and split_part(storage.objects.name, '/', 3) <> ''
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.company_id = split_part(storage.objects.name, '/', 1)::uuid
  )
  and exists (
    select 1 from public.projects pr
    where pr.id = split_part(storage.objects.name, '/', 2)::uuid
      and pr.company_id = split_part(storage.objects.name, '/', 1)::uuid
  )
);

create policy project_receipts_storage_update on storage.objects
for update to authenticated
using (
  bucket_id = 'project-receipts'
  and exists (
    select 1 from public.project_receipts r
    join public.profiles p on p.id = auth.uid() and p.company_id = r.company_id
    where r.storage_path = storage.objects.name
  )
)
with check (
  bucket_id = 'project-receipts'
  and exists (
    select 1 from public.project_receipts r
    join public.profiles p on p.id = auth.uid() and p.company_id = r.company_id
    where r.storage_path = storage.objects.name
  )
);

create policy project_receipts_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'project-receipts'
  and exists (
    select 1 from public.project_receipts r
    join public.profiles p on p.id = auth.uid() and p.company_id = r.company_id
    where r.storage_path = storage.objects.name
  )
);

commit;
