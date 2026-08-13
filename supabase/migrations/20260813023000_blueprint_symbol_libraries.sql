begin;

alter table public.blueprint_annotations drop constraint if exists blueprint_annotations_annotation_type_check;
alter table public.blueprint_annotations add constraint blueprint_annotations_annotation_type_check
  check (annotation_type in ('freehand','arrow','text','pin','calibration','distance','area','symbol'));

create table public.blueprint_symbol_definitions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  category text not null check (category in ('architectural','electrical','plumbing','mechanical','fire','site','custom')),
  symbol_key text not null check (char_length(btrim(symbol_key)) between 1 and 80),
  label text not null check (char_length(btrim(label)) between 1 and 120),
  glyph text not null check (char_length(glyph) between 1 and 12),
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((company_id is null and created_by is null) or (company_id is not null and created_by is not null))
);
create unique index blueprint_system_symbol_key_idx on public.blueprint_symbol_definitions(symbol_key) where company_id is null;
create unique index blueprint_company_symbol_key_idx on public.blueprint_symbol_definitions(company_id, symbol_key) where company_id is not null;
alter table public.blueprint_symbol_definitions enable row level security;
create policy blueprint_symbols_select on public.blueprint_symbol_definitions for select to authenticated using (company_id is null or public.is_company_member(company_id));
create policy blueprint_symbols_insert on public.blueprint_symbol_definitions for insert to authenticated with check (company_id is not null and public.is_company_member(company_id) and created_by = auth.uid() and category = 'custom');
create policy blueprint_symbols_delete on public.blueprint_symbol_definitions for delete to authenticated using (company_id is not null and public.is_company_member(company_id) and created_by = auth.uid());

insert into public.blueprint_symbol_definitions(category,symbol_key,label,glyph) values
('architectural','door','Door','D'),('architectural','window','Window','W'),('architectural','stair','Stair','↕'),
('electrical','outlet','Duplex outlet','◉'),('electrical','switch','Light switch','S'),('electrical','light','Light fixture','⊗'),
('plumbing','fixture','Plumbing fixture','P'),('plumbing','floor-drain','Floor drain','FD'),
('mechanical','supply-air','Supply air','SA'),('mechanical','return-air','Return air','RA'),
('fire','sprinkler','Sprinkler head','●'),('fire','extinguisher','Fire extinguisher','FE'),
('site','north-arrow','North arrow','N↑'),('site','benchmark','Benchmark','△')
on conflict do nothing;
commit;
