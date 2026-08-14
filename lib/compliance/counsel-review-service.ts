import type { SupabaseClient } from "@supabase/supabase-js";

// Phase 9 RPC/table types are migration-backed until the next generated-type refresh.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

export type CounselReviewDisposition = "NO_OBJECTION" | "CHANGES_REQUIRED" | "ADVISORY_ONLY";
export type CounselReviewerCapacity = "counsel" | "authorized_reviewer";

export type RecordCounselReviewInput = {
  companyId: string;
  estimateId: string;
  jurisdictionPackId: string;
  reviewScope: string;
  disposition: CounselReviewDisposition;
  reviewerName: string;
  reviewerOrganization?: string | null;
  reviewerCapacity?: CounselReviewerCapacity;
  reviewedAt?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
};

export type CounselReviewRecord = {
  id: string;
  companyId: string;
  estimateId: string;
  jurisdictionPackId: string;
  rulesetId: string;
  rulesetVersion: string;
  reviewScope: string;
  disposition: CounselReviewDisposition;
  reviewerName: string;
  reviewerOrganization: string | null;
  reviewerCapacity: CounselReviewerCapacity;
  reviewedAt: string;
  recordedByMembershipId: string;
  recordedByRole: string;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

function normalizeCounselReview(value: unknown): CounselReviewRecord {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const disposition: CounselReviewDisposition = row.disposition === "CHANGES_REQUIRED"
    ? "CHANGES_REQUIRED"
    : row.disposition === "ADVISORY_ONLY"
      ? "ADVISORY_ONLY"
      : "NO_OBJECTION";
  const reviewerCapacity: CounselReviewerCapacity = row.reviewer_capacity === "authorized_reviewer"
    ? "authorized_reviewer"
    : "counsel";

  return {
    id: String(row.id || ""),
    companyId: String(row.company_id || ""),
    estimateId: String(row.estimate_id || ""),
    jurisdictionPackId: String(row.jurisdiction_pack_id || ""),
    rulesetId: String(row.ruleset_id || ""),
    rulesetVersion: String(row.ruleset_version || ""),
    reviewScope: String(row.review_scope || ""),
    disposition,
    reviewerName: String(row.reviewer_name || ""),
    reviewerOrganization: typeof row.reviewer_organization === "string" ? row.reviewer_organization : null,
    reviewerCapacity,
    reviewedAt: String(row.reviewed_at || ""),
    recordedByMembershipId: String(row.recorded_by_membership_id || ""),
    recordedByRole: String(row.recorded_by_role || ""),
    notes: typeof row.notes === "string" ? row.notes : null,
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {},
    createdAt: String(row.created_at || ""),
  };
}

export async function recordCounselReview(db: AnySupabase, input: RecordCounselReviewInput) {
  const { data, error } = await db.rpc("record_compliance_counsel_review", {
    p_company_id: input.companyId,
    p_estimate_id: input.estimateId,
    p_jurisdiction_pack_id: input.jurisdictionPackId,
    p_review_scope: input.reviewScope,
    p_disposition: input.disposition,
    p_reviewer_name: input.reviewerName,
    p_reviewer_organization: input.reviewerOrganization || null,
    p_reviewer_capacity: input.reviewerCapacity || "counsel",
    p_reviewed_at: input.reviewedAt || null,
    p_notes: input.notes || null,
    p_metadata: input.metadata || {},
  });

  if (error) {
    throw new Error(error.message || "Unable to record compliance counsel review.");
  }

  return normalizeCounselReview(data);
}

export async function listCounselReviews(db: AnySupabase, companyId: string, estimateId: string) {
  const { data, error } = await db
    .from("compliance_counsel_reviews")
    .select("*")
    .eq("company_id", companyId)
    .eq("estimate_id", estimateId)
    .order("reviewed_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Unable to load compliance counsel reviews.");
  }

  return (Array.isArray(data) ? data : []).map(normalizeCounselReview);
}
