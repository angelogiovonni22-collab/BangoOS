begin;

create or replace function public.get_trade_partner_message_threads()
returns table(
  assignment_id uuid,
  project_id uuid,
  project_name text,
  vendor_id uuid,
  trade_name text,
  assignment_status text,
  last_message_at timestamptz,
  message_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    tpa.id,
    tpa.project_id,
    p.name,
    tpa.vendor_id,
    tpa.trade_name,
    tpa.assignment_status,
    max(m.created_at),
    count(m.id)
  from public.trade_partner_assignments tpa
  join public.projects p on p.id = tpa.project_id and p.company_id = tpa.company_id
  left join public.trade_partner_messages m
    on m.company_id = tpa.company_id
   and m.project_id = tpa.project_id
   and m.vendor_id = tpa.vendor_id
  where public.bos_role_has_permission(tpa.company_id, 'communications.view')
    and not public.bos_is_trade_partner_for_company(tpa.company_id)
    and tpa.assignment_status = 'active'
  group by tpa.id, tpa.project_id, p.name, tpa.vendor_id, tpa.trade_name, tpa.assignment_status
  order by max(m.created_at) desc nulls last, p.name, tpa.trade_name;
$$;

create or replace function public.get_trade_partner_messages_for_assignment(p_assignment_id uuid)
returns table(
  id uuid,
  project_id uuid,
  vendor_id uuid,
  body text,
  sender_type text,
  sender_user_id uuid,
  created_at timestamptz,
  is_mine boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment public.trade_partner_assignments%rowtype;
begin
  select * into v_assignment from public.trade_partner_assignments where id = p_assignment_id;
  if not found then raise exception 'Trade partner assignment not found.' using errcode = 'P0002'; end if;
  if not public.bos_role_has_permission(v_assignment.company_id, 'communications.view')
     or public.bos_is_trade_partner_for_company(v_assignment.company_id) then
    raise exception 'Trade partner message access denied.' using errcode = '42501';
  end if;

  return query
  select m.id, m.project_id, m.vendor_id, m.body, m.sender_type, m.sender_user_id, m.created_at,
         m.sender_user_id = auth.uid()
  from public.trade_partner_messages m
  where m.company_id = v_assignment.company_id
    and m.project_id = v_assignment.project_id
    and m.vendor_id = v_assignment.vendor_id
  order by m.created_at asc
  limit 500;
end;
$$;

create or replace function public.send_trade_partner_message_for_assignment(
  p_assignment_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment public.trade_partner_assignments%rowtype;
  v_id uuid;
begin
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 4000 then
    raise exception 'Message must contain between 1 and 4000 characters.' using errcode = '22023';
  end if;

  select * into v_assignment from public.trade_partner_assignments where id = p_assignment_id;
  if not found or v_assignment.assignment_status <> 'active' then
    raise exception 'Active trade partner assignment not found.' using errcode = 'P0002';
  end if;

  if not public.bos_role_has_permission(v_assignment.company_id, 'communications.manage')
     or public.bos_is_trade_partner_for_company(v_assignment.company_id) then
    raise exception 'Trade partner messaging is not authorized.' using errcode = '42501';
  end if;

  insert into public.trade_partner_messages(
    company_id, project_id, vendor_id, sender_user_id, sender_type, body
  ) values (
    v_assignment.company_id, v_assignment.project_id, v_assignment.vendor_id,
    auth.uid(), 'internal', btrim(p_body)
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.get_trade_partner_message_threads() from public;
revoke all on function public.get_trade_partner_messages_for_assignment(uuid) from public;
revoke all on function public.send_trade_partner_message_for_assignment(uuid,text) from public;
grant execute on function public.get_trade_partner_message_threads() to authenticated;
grant execute on function public.get_trade_partner_messages_for_assignment(uuid) to authenticated;
grant execute on function public.send_trade_partner_message_for_assignment(uuid,text) to authenticated;

commit;
