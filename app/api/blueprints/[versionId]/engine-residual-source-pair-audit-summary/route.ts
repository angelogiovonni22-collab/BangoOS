import { NextResponse } from "next/server";
import { GET as getResidualSourcePairAudit } from "../engine-residual-source-pair-audit/route";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

type ResidualAuditPayload = {
  mode?: string;
  source?: unknown;
  preselection?: unknown;
  audit?: {
    sourcePairCount?: number;
    uniquelyRepresentedPairCount?: number;
    ambiguousPairCount?: number;
    unmatchedPairCount?: number;
    unmatchedSourceLengthMeters?: number;
    unmatchedSourceLengthRatio?: number;
    mismatchSummary?: unknown;
    familyMemberRecovery?: unknown;
  };
  safety?: unknown;
  error?: string;
};

export async function GET(request: Request, context: { params: Promise<{ versionId: string }> }) {
  const response = await getResidualSourcePairAudit(request, context);
  const payload = await response.json() as ResidualAuditPayload;
  if (!response.ok) return NextResponse.json(payload, { status: response.status, headers: { "Cache-Control": "no-store" } });

  return NextResponse.json({
    mode: "read_only_residual_source_pair_audit_summary",
    source: payload.source,
    preselection: payload.preselection,
    audit: {
      sourcePairCount: payload.audit?.sourcePairCount ?? null,
      uniquelyRepresentedPairCount: payload.audit?.uniquelyRepresentedPairCount ?? null,
      ambiguousPairCount: payload.audit?.ambiguousPairCount ?? null,
      unmatchedPairCount: payload.audit?.unmatchedPairCount ?? null,
      unmatchedSourceLengthMeters: payload.audit?.unmatchedSourceLengthMeters ?? null,
      unmatchedSourceLengthRatio: payload.audit?.unmatchedSourceLengthRatio ?? null,
      mismatchSummary: payload.audit?.mismatchSummary ?? null,
      familyMemberRecovery: payload.audit?.familyMemberRecovery ?? null,
    },
    safety: payload.safety,
  }, { headers: { "Cache-Control": "no-store" } });
}
