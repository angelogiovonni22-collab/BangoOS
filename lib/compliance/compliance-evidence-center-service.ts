import type { SupabaseClient } from "@supabase/supabase-js";

// Phase 7 RPC/view types are migration-backed until the next generated-type refresh.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

export type ComplianceEvidenceDomain = "home_solicitation" | "operational_work_start";

export type ComplianceEvidenceRecord = {
  evidenceDomain: ComplianceEvidenceDomain;
  evidenceId: string;
  companyId: string;
  projectId: string | null;
  estimateId: string;
  changeOrderId: string | null;
  evidenceType: string;
  decision: "ALLOWED" | "BLOCKED" | null;
  blockerCode: string | null;
  actorProfileId: string | null;
  source: string;
  occurredAt: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

type EvidenceQuery = {
  companyId: string;
  projectId?: string | null;
  estimateId?: string | null;
  limit?: number;
};

function normalizeRecord(value: unknown): ComplianceEvidenceRecord {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const domain = row.evidence_domain === "operational_work_start"
    ? "operational_work_start"
    : "home_solicitation";
  const decision = row.decision === "ALLOWED" || row.decision === "BLOCKED" ? row.decision : null;

  return {
    evidenceDomain: domain,
    evidenceId: String(row.evidence_id || ""),
    companyId: String(row.company_id || ""),
    projectId: typeof row.project_id === "string" ? row.project_id : null,
    estimateId: String(row.estimate_id || ""),
    changeOrderId: typeof row.change_order_id === "string" ? row.change_order_id : null,
    evidenceType: String(row.evidence_type || ""),
    decision,
    blockerCode: typeof row.blocker_code === "string" ? row.blocker_code : null,
    actorProfileId: typeof row.actor_profile_id === "string" ? row.actor_profile_id : null,
    source: String(row.source || "system"),
    occurredAt: String(row.occurred_at || row.created_at || ""),
    createdAt: String(row.created_at || ""),
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {},
  };
}

export async function listComplianceEvidence(db: AnySupabase, input: EvidenceQuery) {
  const { data, error } = await db.rpc("get_compliance_evidence_center", {
    p_company_id: input.companyId,
    p_project_id: input.projectId || null,
    p_estimate_id: input.estimateId || null,
    p_limit: Math.min(Math.max(input.limit || 100, 1), 500),
  });

  if (error) {
    throw new Error(error.message || "Unable to load compliance evidence.");
  }

  return (Array.isArray(data) ? data : []).map(normalizeRecord);
}

export function summarizeComplianceEvidence(records: ComplianceEvidenceRecord[]) {
  return records.reduce(
    (summary, record) => {
      summary.total += 1;
      if (record.decision === "ALLOWED") summary.allowed += 1;
      if (record.decision === "BLOCKED") summary.blocked += 1;
      if (record.blockerCode) summary.blockers.add(record.blockerCode);
      summary.domains.add(record.evidenceDomain);
      return summary;
    },
    { total: 0, allowed: 0, blocked: 0, blockers: new Set<string>(), domains: new Set<ComplianceEvidenceDomain>() },
  );
}
