-- Store-safe account deletion request queue.
-- This migration records verified requests without automatically deleting auth,
-- tenant, billing, or retained business records. Destructive processing remains
-- a separate reviewed workflow.

create table if not exists public.user_account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  requested_email text,
  reason text,
  status text not null default 'pending' check (status in ('pending','processing','completed','rejected')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_notes text
);

create unique index if not exists user_account_deletion_requests_one_pending_per_user
  on public.user_account_deletion_requests(user_id)
  where status = 'pending';

create index if not exists user_account_deletion_requests_requested_at_idx
  on public.user_account_deletion_requests(requested_at desc);

alter table public.user_account_deletion_requests enable row level security;

revoke all on public.user_account_deletion_requests from anon;
grant select, insert on public.user_account_deletion_requests to authenticated;

drop policy if exists user_account_deletion_requests_select_own on public.user_account_deletion_requests;
create policy user_account_deletion_requests_select_own
on public.user_account_deletion_requests
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists user_account_deletion_requests_insert_own on public.user_account_deletion_requests;
create policy user_account_deletion_requests_insert_own
on public.user_account_deletion_requests
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
  and processed_at is null
  and processing_notes is null
);
