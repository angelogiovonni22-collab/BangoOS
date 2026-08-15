create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.dispatch_due_orion_reminders()
returns bigint
language plpgsql
security definer
set search_path = public, vault, net, extensions
as $$
declare
  dispatch_url text;
  dispatch_secret text;
  request_id bigint;
begin
  select decrypted_secret
    into dispatch_url
  from vault.decrypted_secrets
  where name = 'orion_push_dispatch_url'
  order by updated_at desc
  limit 1;

  select decrypted_secret
    into dispatch_secret
  from vault.decrypted_secrets
  where name = 'orion_push_dispatch_secret'
  order by updated_at desc
  limit 1;

  if coalesce(dispatch_url, '') = '' or coalesce(dispatch_secret, '') = '' then
    return null;
  end if;

  select net.http_post(
    url := dispatch_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-orion-push-secret', dispatch_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  )
  into request_id;

  return request_id;
end;
$$;

revoke all on function public.dispatch_due_orion_reminders() from public;
revoke all on function public.dispatch_due_orion_reminders() from anon;
revoke all on function public.dispatch_due_orion_reminders() from authenticated;
grant execute on function public.dispatch_due_orion_reminders() to postgres;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
    into existing_job_id
  from cron.job
  where jobname = 'orion-push-dispatch'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end;
$$;

select cron.schedule(
  'orion-push-dispatch',
  '* * * * *',
  $$select public.dispatch_due_orion_reminders();$$
);
