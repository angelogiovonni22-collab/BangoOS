alter table public.projects
  add column if not exists job_site_name text,
  add column if not exists primary_contact_name text,
  add column if not exists primary_contact_phone text,
  add column if not exists primary_contact_email text,
  add column if not exists required_down_payment numeric not null default 0;

alter table public.projects
  add constraint projects_required_down_payment_nonnegative
  check (required_down_payment >= 0);
