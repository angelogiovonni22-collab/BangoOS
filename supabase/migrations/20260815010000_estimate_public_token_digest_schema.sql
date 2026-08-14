begin;

-- Supabase installs pgcrypto in the extensions schema. This security-definer
-- function intentionally excludes that schema from search_path, so cryptographic
-- calls must be schema-qualified.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.validate_estimate_public_token(
  p_token text,
  p_ip_address text default null,
  p_user_agent text default null
)
returns table (
  token_id uuid,
  company_id uuid,
  estimate_id uuid,
  expires_at timestamptz,
  is_valid boolean,
  failure_reason text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token_hash text;
  v_row public.estimate_public_tokens%rowtype;
begin
  if p_token is null or btrim(p_token) = '' then
    return query
      select null::uuid, null::uuid, null::uuid, null::timestamptz, false, 'token_missing'::text;
    return;
  end if;

  v_token_hash := encode(extensions.digest(p_token, 'sha256'::text), 'hex');

  select *
    into v_row
  from public.estimate_public_tokens t
  where t.token_hash = v_token_hash
  limit 1;

  if not found then
    return query
      select null::uuid, null::uuid, null::uuid, null::timestamptz, false, 'token_not_found'::text;
    return;
  end if;

  if v_row.revoked_at is not null then
    return query
      select v_row.id, v_row.company_id, v_row.estimate_id, v_row.expires_at, false, 'token_revoked'::text;
    return;
  end if;

  if v_row.expires_at <= now() then
    return query
      select v_row.id, v_row.company_id, v_row.estimate_id, v_row.expires_at, false, 'token_expired'::text;
    return;
  end if;

  update public.estimate_public_tokens
     set view_count = view_count + 1,
         last_viewed_at = now(),
         last_viewed_ip = coalesce(p_ip_address, last_viewed_ip),
         last_viewed_user_agent = coalesce(p_user_agent, last_viewed_user_agent),
         updated_at = now()
   where id = v_row.id;

  return query
    select v_row.id, v_row.company_id, v_row.estimate_id, v_row.expires_at, true, null::text;
end;
$$;

revoke all on function public.validate_estimate_public_token(text, text, text) from public;
grant execute on function public.validate_estimate_public_token(text, text, text) to anon, authenticated;

commit;
