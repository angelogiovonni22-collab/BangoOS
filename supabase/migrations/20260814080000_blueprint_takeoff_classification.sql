begin;
alter table public.blueprint_annotations add column if not exists takeoff_name text null,add column if not exists takeoff_category text null,add column if not exists cost_code_id uuid null;
alter table public.blueprint_annotations drop constraint if exists blueprint_annotations_takeoff_category_check;
alter table public.blueprint_annotations add constraint blueprint_annotations_takeoff_category_check check(takeoff_category is null or takeoff_category in('labor','materials','equipment','subcontractors','general_conditions','permits_fees','other'));
alter table public.blueprint_annotations drop constraint if exists blueprint_annotations_cost_code_company_fkey;
alter table public.blueprint_annotations add constraint blueprint_annotations_cost_code_company_fkey foreign key(cost_code_id,company_id) references public.cost_codes(id,company_id) on delete set null;
create index if not exists blueprint_annotations_takeoff_cost_code_idx on public.blueprint_annotations(company_id,project_id,cost_code_id) where annotation_type in('distance','area');
create or replace function public.classify_blueprint_takeoff(p_company_id uuid,p_project_id uuid,p_blueprint_version_id uuid,p_annotation_id uuid,p_takeoff_name text,p_category text,p_cost_code_id uuid default null) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
if auth.uid() is null or not public.is_company_member(p_company_id) then raise exception 'Blueprint takeoff classification is not authorized.' using errcode='42501';end if;
if p_category not in('labor','materials','equipment','subcontractors','general_conditions','permits_fees','other') then raise exception 'Invalid estimate category.' using errcode='22023';end if;
if p_cost_code_id is not null then perform 1 from public.cost_codes where id=p_cost_code_id and company_id=p_company_id and status='active';if not found then raise exception 'Active company cost code was not found.' using errcode='P0002';end if;end if;
update public.blueprint_annotations set takeoff_name=nullif(btrim(p_takeoff_name),''),takeoff_category=p_category,cost_code_id=p_cost_code_id,updated_at=now() where id=p_annotation_id and company_id=p_company_id and project_id=p_project_id and blueprint_version_id=p_blueprint_version_id and annotation_type in('distance','area');
if not found then raise exception 'Blueprint takeoff was not found.' using errcode='P0002';end if;
update public.estimate_line_items li set category=p_category,description=coalesce(nullif(btrim(p_takeoff_name),''),li.description),item_code=cc.code,updated_at=now() from public.blueprint_operational_links l left join public.cost_codes cc on cc.id=p_cost_code_id and cc.company_id=p_company_id where l.company_id=p_company_id and l.annotation_id=p_annotation_id and l.target_type='estimate_line_item' and li.id=l.target_id and li.company_id=l.company_id;
end;$$;
revoke all on function public.classify_blueprint_takeoff(uuid,uuid,uuid,uuid,text,text,uuid) from public;grant execute on function public.classify_blueprint_takeoff(uuid,uuid,uuid,uuid,text,text,uuid) to authenticated;
create or replace function public.apply_blueprint_takeoff_classification_on_link() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
if new.target_type='estimate_line_item' then update public.estimate_line_items li set category=coalesce(a.takeoff_category,li.category),description=coalesce(a.takeoff_name,li.description),item_code=cc.code,updated_at=now() from public.blueprint_annotations a left join public.cost_codes cc on cc.id=a.cost_code_id and cc.company_id=a.company_id where a.id=new.annotation_id and a.company_id=new.company_id and li.id=new.target_id and li.company_id=new.company_id;end if;return new;end;$$;
revoke all on function public.apply_blueprint_takeoff_classification_on_link() from public,anon,authenticated;
drop trigger if exists trg_blueprint_takeoff_classification_on_link on public.blueprint_operational_links;
create trigger trg_blueprint_takeoff_classification_on_link after insert on public.blueprint_operational_links for each row execute function public.apply_blueprint_takeoff_classification_on_link();
commit;
