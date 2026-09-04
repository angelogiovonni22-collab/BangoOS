begin;

create table public.bos_industry_templates (
  key text primary key,
  label text not null,
  version integer not null default 1 check (version > 0),
  status text not null default 'active' check (status in ('active','inactive')),
  labels jsonb not null default '{}'::jsonb,
  enabled_modules jsonb not null default '[]'::jsonb,
  workflow_hints jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_operating_profiles (
  company_id uuid primary key references public.companies(id) on delete cascade,
  industry_key text not null default 'construction' references public.bos_industry_templates(key),
  industry_label text null,
  business_model text null,
  primary_services text[] not null default '{}'::text[],
  workforce_model text null,
  customer_model text null,
  inventory_model text null,
  compliance_profile jsonb not null default '{}'::jsonb,
  module_overrides jsonb not null default '{}'::jsonb,
  terminology_overrides jsonb not null default '{}'::jsonb,
  workflow_overrides jsonb not null default '{}'::jsonb,
  discovery_answers jsonb not null default '{}'::jsonb,
  config_version integer not null default 1 check (config_version > 0),
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index company_operating_profiles_industry_idx
  on public.company_operating_profiles(industry_key);

insert into public.bos_industry_templates (key,label,labels,enabled_modules,workflow_hints) values
('construction','Construction',
  '{"project":"Project","projects":"Projects","customer":"Customer","customers":"Customers","estimate":"Estimate","estimates":"Estimates","vendor":"Contractor or Vendor","vendors":"Contractors & Vendors","workforce":"Workforce","materials":"Materials","procurement":"Procurement","equipment":"Equipment"}'::jsonb,
  '["dashboard","crm","customers","estimates","projects","scheduling","workforce","payroll","vendors","materials","inventory","procurement","equipment","documents","compliance","finance","banking","orion"]'::jsonb,
  '{"projectLifecycle":"lead>estimate>approval>project>procurement>field_execution>closeout","schedulingModel":"crew_and_trade","costingModel":"job_costing"}'::jsonb),
('cleaning','Cleaning Services',
  '{"project":"Service Job","projects":"Service Jobs","customer":"Client","customers":"Clients","estimate":"Quote","estimates":"Quotes","vendor":"Supplier or Partner","vendors":"Suppliers & Partners","workforce":"Cleaning Teams","materials":"Cleaning Supplies","procurement":"Supply Purchasing","equipment":"Cleaning Equipment"}'::jsonb,
  '["dashboard","crm","customers","estimates","projects","scheduling","workforce","payroll","vendors","materials","inventory","procurement","equipment","documents","finance","banking","orion"]'::jsonb,
  '{"projectLifecycle":"lead>quote>service_plan>dispatch>service>inspection>invoice","schedulingModel":"recurring_and_route","costingModel":"service_job_costing"}'::jsonb),
('healthcare','Healthcare',
  '{"project":"Care Program","projects":"Care Programs","customer":"Patient or Client","customers":"Patients & Clients","estimate":"Service Plan","estimates":"Service Plans","vendor":"Provider or Supplier","vendors":"Providers & Suppliers","workforce":"Care Team","materials":"Clinical Supplies","procurement":"Supply Purchasing","equipment":"Medical Equipment"}'::jsonb,
  '["dashboard","crm","customers","estimates","projects","scheduling","workforce","payroll","vendors","inventory","procurement","equipment","documents","compliance","finance","banking","orion"]'::jsonb,
  '{"projectLifecycle":"intake>eligibility>care_plan>schedule>service>documentation>billing","schedulingModel":"credential_and_availability","costingModel":"service_line_costing"}'::jsonb),
('manufacturing','Manufacturing',
  '{"project":"Production Order","projects":"Production Orders","customer":"Customer","customers":"Customers","estimate":"Quote","estimates":"Quotes","vendor":"Supplier","vendors":"Suppliers","workforce":"Production Workforce","materials":"Raw Materials","procurement":"Purchasing","equipment":"Plant Equipment"}'::jsonb,
  '["dashboard","crm","customers","estimates","projects","scheduling","workforce","payroll","vendors","materials","inventory","procurement","equipment","documents","compliance","finance","banking","orion"]'::jsonb,
  '{"projectLifecycle":"demand>quote>production_order>material_plan>production>quality>shipment","schedulingModel":"capacity_and_shift","costingModel":"production_order_costing"}'::jsonb),
('logistics','Logistics',
  '{"project":"Shipment","projects":"Shipments","customer":"Account","customers":"Accounts","estimate":"Rate Quote","estimates":"Rate Quotes","vendor":"Carrier or Vendor","vendors":"Carriers & Vendors","workforce":"Drivers & Operations","materials":"Consumables","procurement":"Purchasing","equipment":"Fleet"}'::jsonb,
  '["dashboard","crm","customers","estimates","projects","scheduling","workforce","payroll","vendors","procurement","equipment","documents","compliance","finance","banking","orion"]'::jsonb,
  '{"projectLifecycle":"request>rate_quote>dispatch>pickup>in_transit>delivery>billing","schedulingModel":"route_and_asset","costingModel":"shipment_costing"}'::jsonb),
('professional_services','Professional Services',
  '{"project":"Engagement","projects":"Engagements","customer":"Client","customers":"Clients","estimate":"Proposal","estimates":"Proposals","vendor":"Partner or Vendor","vendors":"Partners & Vendors","workforce":"Team","materials":"Resources","procurement":"Purchasing","equipment":"Assets"}'::jsonb,
  '["dashboard","crm","customers","estimates","projects","scheduling","workforce","payroll","vendors","documents","finance","banking","orion"]'::jsonb,
  '{"projectLifecycle":"lead>proposal>engagement>delivery>review>invoice","schedulingModel":"people_and_capacity","costingModel":"engagement_costing"}'::jsonb),
('generic','Business',
  '{"project":"Work Item","projects":"Work","customer":"Customer","customers":"Customers","estimate":"Quote","estimates":"Quotes","vendor":"Vendor","vendors":"Vendors","workforce":"Team","materials":"Supplies","procurement":"Purchasing","equipment":"Assets"}'::jsonb,
  '["dashboard","crm","customers","estimates","projects","scheduling","workforce","vendors","documents","finance","banking","orion"]'::jsonb,
  '{"projectLifecycle":"lead>quote>work>delivery>invoice","schedulingModel":"people_and_time","costingModel":"work_costing"}'::jsonb)
on conflict (key) do update set
  label = excluded.label,
  labels = excluded.labels,
  enabled_modules = excluded.enabled_modules,
  workflow_hints = excluded.workflow_hints,
  updated_at = now();

-- Existing workspaces remain construction through the application fallback until an administrator saves a profile.

alter table public.bos_industry_templates enable row level security;
alter table public.company_operating_profiles enable row level security;

create policy bos_industry_templates_select on public.bos_industry_templates
  for select to authenticated
  using (status = 'active');

create policy company_operating_profiles_select on public.company_operating_profiles
  for select to authenticated
  using (public.is_company_member(company_id));

create policy company_operating_profiles_insert on public.company_operating_profiles
  for insert to authenticated
  with check (
    public.is_company_member(company_id)
    and created_by = auth.uid()
    and updated_by = auth.uid()
    and exists (
      select 1 from public.company_memberships m
      where m.company_id = company_operating_profiles.company_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role in ('owner','administrator')
    )
  );

create policy company_operating_profiles_update on public.company_operating_profiles
  for update to authenticated
  using (
    public.is_company_member(company_id)
    and exists (
      select 1 from public.company_memberships m
      where m.company_id = company_operating_profiles.company_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role in ('owner','administrator')
    )
  )
  with check (
    public.is_company_member(company_id)
    and updated_by = auth.uid()
    and exists (
      select 1 from public.company_memberships m
      where m.company_id = company_operating_profiles.company_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role in ('owner','administrator')
    )
  );

commit;
