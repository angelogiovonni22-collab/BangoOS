-- Backfill converted Projects that predate estimate job-site snapshot preservation.
-- The accepted estimate prospect remains the source of truth for the quoted job site;
-- the Customer master record is intentionally left unchanged.
with candidates as (
  select
    p.id project_id,
    coalesce(nullif(btrim(coalesce(ep.address_line_1,'')),''), c.address_line_1) address_line_1,
    coalesce(nullif(btrim(coalesce(ep.address_line_2,'')),''), c.address_line_2) address_line_2,
    coalesce(nullif(btrim(coalesce(ep.city,'')),''), c.city) city,
    coalesce(nullif(btrim(coalesce(ep.state,'')),''), c.state) state,
    coalesce(nullif(btrim(coalesce(ep.postal_code,'')),''), c.postal_code) postal_code,
    coalesce(nullif(btrim(concat_ws(' ',ep.first_name,ep.last_name)),''), concat_ws(' ',c.first_name,c.last_name)) primary_contact_name,
    coalesce(nullif(btrim(coalesce(ep.phone,'')),''), c.phone) primary_contact_phone,
    coalesce(nullif(btrim(coalesce(ep.email,'')),''), c.email) primary_contact_email
  from public.estimates e
  join public.estimate_prospects ep on ep.company_id=e.company_id and ep.estimate_id=e.id
  join public.projects p on p.company_id=e.company_id and p.id=e.converted_project_id
  join public.customers c on c.company_id=e.company_id and c.id=e.customer_id
  where e.conversion_state='converted'
    and nullif(btrim(coalesce(ep.address_line_1,'')),'') is not null
    and (
      btrim(coalesce(p.address_line_1,'')) is distinct from btrim(ep.address_line_1)
      or btrim(coalesce(p.city,'')) is distinct from btrim(ep.city)
      or btrim(coalesce(p.state,'')) is distinct from btrim(ep.state)
      or btrim(coalesce(p.postal_code,'')) is distinct from btrim(ep.postal_code)
    )
)
update public.projects p
set address_line_1=c.address_line_1,
    address_line_2=c.address_line_2,
    city=c.city,
    state=c.state,
    postal_code=c.postal_code,
    primary_contact_name=c.primary_contact_name,
    primary_contact_phone=c.primary_contact_phone,
    primary_contact_email=c.primary_contact_email,
    updated_at=now()
from candidates c
where p.id=c.project_id;
