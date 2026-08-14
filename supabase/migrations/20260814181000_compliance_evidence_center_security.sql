begin;

-- Keep the unified evidence center read-only while preserving source-table RLS.
revoke all on public.compliance_evidence_center from anon;
revoke all on public.compliance_evidence_center from public;
grant select on public.compliance_evidence_center to authenticated;

revoke all on function public.get_compliance_evidence_center(uuid, uuid, uuid, integer) from public;
revoke all on function public.get_compliance_evidence_center(uuid, uuid, uuid, integer) from anon;
grant execute on function public.get_compliance_evidence_center(uuid, uuid, uuid, integer) to authenticated;

commit;
