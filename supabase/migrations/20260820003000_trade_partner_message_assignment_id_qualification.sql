begin;

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
  select tpa.*
    into v_assignment
  from public.trade_partner_assignments as tpa
  where tpa.id = p_assignment_id;

  if not found then
    raise exception 'Trade partner assignment not found.' using errcode = 'P0002';
  end if;

  if not public.bos_role_has_permission(v_assignment.company_id, 'communications.view')
     or public.bos_is_trade_partner_for_company(v_assignment.company_id) then
    raise exception 'Trade partner message access denied.' using errcode = '42501';
  end if;

  return query
  select
    m.id,
    m.project_id,
    m.vendor_id,
    m.body,
    m.sender_type,
    m.sender_user_id,
    m.created_at,
    m.sender_user_id = auth.uid()
  from public.trade_partner_messages as m
  where m.company_id = v_assignment.company_id
    and m.project_id = v_assignment.project_id
    and m.vendor_id = v_assignment.vendor_id
  order by m.created_at asc
  limit 500;
end;
$$;

revoke all on function public.get_trade_partner_messages_for_assignment(uuid) from public;
grant execute on function public.get_trade_partner_messages_for_assignment(uuid) to authenticated;

commit;
