begin;

create index if not exists bos_notifications_recipient_user_idx
  on public.bos_notifications (recipient_user_id);

create index if not exists bos_notifications_actor_user_idx
  on public.bos_notifications (actor_user_id)
  where actor_user_id is not null;

commit;
