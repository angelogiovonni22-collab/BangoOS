-- Commercial-launch performance hardening.
-- Add supporting indexes for active foreign-key paths that currently lack a
-- leading-column index. These are additive and do not change data semantics.

create index if not exists idx_workflow_events_actor_profile_company
  on public.workflow_events (actor_profile_id, company_id);

create index if not exists idx_workflow_events_causation_event
  on public.workflow_events (causation_id);

create index if not exists idx_profiles_company_id
  on public.profiles (company_id);

create index if not exists idx_project_closeout_items_closeout_id
  on public.project_closeout_items (closeout_id);

create index if not exists idx_project_closeout_items_completed_by_company
  on public.project_closeout_items (completed_by, company_id);

create index if not exists idx_project_closeout_items_created_by_company
  on public.project_closeout_items (created_by, company_id);

create index if not exists idx_project_closeout_items_project_company
  on public.project_closeout_items (project_id, company_id);

create index if not exists idx_project_closeout_items_updated_by_company
  on public.project_closeout_items (updated_by, company_id);

create index if not exists idx_trade_partner_invitations_created_by
  on public.trade_partner_invitations (created_by);

create index if not exists idx_trade_partner_invitations_user_id
  on public.trade_partner_invitations (user_id);

create index if not exists idx_trade_partner_invitations_vendor_company
  on public.trade_partner_invitations (vendor_id, company_id);

create index if not exists idx_workforce_orion_timeline_events_actor_company
  on public.workforce_orion_timeline_events (actor_profile_id, company_id);

create index if not exists idx_workforce_orion_timeline_events_crew_company
  on public.workforce_orion_timeline_events (crew_id, company_id);

create index if not exists idx_workforce_orion_timeline_events_employee_company
  on public.workforce_orion_timeline_events (employee_id, company_id);

create index if not exists idx_workforce_orion_timeline_events_project_company
  on public.workforce_orion_timeline_events (project_id, company_id);
