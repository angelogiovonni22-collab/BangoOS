begin;

-- Preserve existing project compliance evidence when moving standing Trade Partner
-- documents to the company profile. Only promote when no active company document
-- already exists for that requirement type.
with latest_project_documents as (
  select distinct on (d.company_id, d.vendor_id, d.requirement_type)
    d.company_id,
    d.vendor_id,
    d.requirement_type,
    d.storage_path,
    d.original_filename,
    d.mime_type,
    d.file_size_bytes,
    d.expires_at,
    d.uploaded_by,
    d.created_at,
    r.status as requirement_status,
    r.verified_at,
    r.verified_by
  from public.subcontractor_compliance_documents d
  left join public.subcontractor_mobilization_requirements r
    on r.company_id = d.company_id
   and r.assignment_id = d.assignment_id
   and r.requirement_type = d.requirement_type
  where d.status = 'active'
    and d.requirement_type in ('w9','coi','workers_comp','licenses')
  order by d.company_id, d.vendor_id, d.requirement_type, d.created_at desc
)
insert into public.trade_partner_onboarding_documents (
  company_id,
  vendor_id,
  requirement_type,
  storage_path,
  original_filename,
  mime_type,
  file_size_bytes,
  expires_at,
  status,
  uploaded_by,
  created_at,
  updated_at,
  review_status,
  reviewed_at,
  reviewed_by,
  review_note
)
select
  d.company_id,
  d.vendor_id,
  d.requirement_type,
  d.storage_path,
  d.original_filename,
  d.mime_type,
  d.file_size_bytes,
  d.expires_at,
  'active',
  d.uploaded_by,
  d.created_at,
  now(),
  case
    when d.expires_at is not null and d.expires_at <= now() then 'expired'
    when d.requirement_status = 'verified' then 'verified'
    else 'pending'
  end,
  case when d.requirement_status = 'verified' then d.verified_at else null end,
  case when d.requirement_status = 'verified' then d.verified_by else null end,
  'Migrated from existing project compliance record.'
from latest_project_documents d
where not exists (
  select 1
  from public.trade_partner_onboarding_documents current_doc
  where current_doc.company_id = d.company_id
    and current_doc.vendor_id = d.vendor_id
    and current_doc.requirement_type = d.requirement_type
    and current_doc.status = 'active'
);

commit;
