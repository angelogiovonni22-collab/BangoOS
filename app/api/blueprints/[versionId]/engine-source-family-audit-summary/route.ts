import { NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function countSummary(value: unknown) {
  const source = record(value);
  return {
    retainedPairCount: source.retainedPairCount ?? null,
    uniqueAgreementCount: source.uniqueAgreementCount ?? null,
    ambiguousAgreementCount: source.ambiguousAgreementCount ?? null,
    noAgreementCount: source.noAgreementCount ?? null,
    missingFamilyCount: source.missingFamilyCount ?? null,
  };
}

function diagnosticCounts(value: unknown) {
  const source = record(value);
  return {
    familyCount: source.familyCount ?? null,
    memberCount: source.memberCount ?? null,
    failedFaceCount: source.failedFaceCount ?? null,
    reasonMemberCounts: source.reasonMemberCounts ?? null,
    reasonFaceCounts: source.reasonFaceCounts ?? null,
    reasonFamilyCounts: source.reasonFamilyCounts ?? null,
  };
}

function simulationSummary(value: unknown) {
  if (!value) return null;
  const source = record(value);
  return {
    mode: source.mode ?? null,
    baselineDedupeMode: source.baselineDedupeMode ?? null,
    simulatedDedupeMode: source.simulatedDedupeMode ?? null,
    baselineMinRunPixels: source.baselineMinRunPixels ?? null,
    sourceEquivalentMinRunPixels: source.sourceEquivalentMinRunPixels ?? null,
    baselineRasterSegmentCount: source.baselineRasterSegmentCount ?? null,
    parityRasterSegmentCount: source.parityRasterSegmentCount ?? null,
    simulatedRasterSegmentCount: source.simulatedRasterSegmentCount ?? null,
    targetFamilyIds: source.targetFamilyIds ?? null,
    targetFaceCount: source.targetFaceCount ?? null,
    recoverableFaceCount: source.recoverableFaceCount ?? null,
    addedSegmentIds: source.addedSegmentIds ?? null,
    before: source.before ?? null,
    after: source.after ?? null,
    delta: source.delta ?? null,
    previouslyUniqueRegressionFamilyIds: source.previouslyUniqueRegressionFamilyIds ?? null,
    newlyUniqueFamilyIds: source.newlyUniqueFamilyIds ?? null,
    noMatchStageBefore: source.noMatchStageBefore ?? null,
    noMatchStageAfter: source.noMatchStageAfter ?? null,
    safeToConsiderPromotion: source.safeToConsiderPromotion ?? null,
  };
}

function familyIsolationSummary(value: unknown) {
  if (!value) return null;
  const source = record(value);
  const results = Array.isArray(source.results) ? source.results : [];
  return {
    mode: source.mode ?? null,
    familyCount: source.familyCount ?? null,
    safeFamilyCount: source.safeFamilyCount ?? null,
    safeFamilyIds: source.safeFamilyIds ?? null,
    safeAddedSegmentIds: source.safeAddedSegmentIds ?? null,
    regressiveFamilyIds: source.regressiveFamilyIds ?? null,
    ambiguityGrowthFamilyIds: source.ambiguityGrowthFamilyIds ?? null,
    safeResults: results
      .map((entry) => record(entry))
      .filter((entry) => record(entry.summary).safeToConsiderPromotion === true)
      .map((entry) => ({
        representativePairId: entry.representativePairId ?? null,
        summary: simulationSummary(entry.summary),
      })),
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const { versionId } = await params;
    const incoming = new URL(request.url);
    const runShortRunSimulation = incoming.searchParams.get("shortRunSimulation") === "1";
    const targetPath = runShortRunSimulation
      ? `/api/blueprints/${encodeURIComponent(versionId)}/engine-source-backed-shortrun-simulation`
      : `/api/blueprints/${encodeURIComponent(versionId)}/engine-source-family-audit`;
    const targetUrl = new URL(targetPath, incoming.origin);
    const expectedPage = incoming.searchParams.get("expectedPage");
    if (expectedPage) targetUrl.searchParams.set("expectedPage", expectedPage);
    if (!runShortRunSimulation && incoming.searchParams.get("dedupePreservationSimulation") === "1") targetUrl.searchParams.set("dedupePreservationSimulation", "1");
    if (!runShortRunSimulation) targetUrl.searchParams.set("summaryProxy", "1");

    const cookie = request.headers.get("cookie");
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: cookie ? { cookie } : undefined,
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(record(payload), { status: response.status, headers: { "Cache-Control": "no-store" } });
    }

    const root = record(payload);
    const extraction = record(root.extraction);
    const safety = record(root.safety);

    if (runShortRunSimulation) {
      return NextResponse.json({
        mode: "read_only_source_backed_short_run_simulation_summary",
        source: root.source ?? null,
        extraction: {
          sourcePixelWidth: extraction.sourcePixelWidth ?? null,
          sourcePixelHeight: extraction.sourcePixelHeight ?? null,
          rasterPixelWidth: extraction.rasterPixelWidth ?? null,
          rasterPixelHeight: extraction.rasterPixelHeight ?? null,
          baselineRasterSegmentCount: extraction.baselineRasterSegmentCount ?? null,
          sourceEquivalentMinRunPixels: extraction.sourceEquivalentMinRunPixels ?? null,
        },
        baselineDedupeGapCounts: root.baselineDedupeGapCounts ?? null,
        simulation: simulationSummary(root.simulation),
        newlyUniqueOnlySimulation: simulationSummary(root.newlyUniqueOnlySimulation),
        familyIsolationSimulation: familyIsolationSummary(root.familyIsolationSimulation),
        safety: {
          writesPerformed: safety.writesPerformed ?? null,
          extractionChanged: safety.extractionChanged ?? null,
          sourceSelectionChanged: safety.sourceSelectionChanged ?? null,
          canonicalGeometryChanged: safety.canonicalGeometryChanged ?? null,
          generated3d: safety.generated3d ?? null,
        },
      }, { headers: { "Cache-Control": "no-store" } });
    }

    const evidence = record(root.evidence);

    return NextResponse.json({
      mode: "read_only_source_pair_family_audit_summary",
      source: root.source ?? null,
      extraction: {
        rasterSegmentCount: extraction.rasterSegmentCount ?? null,
        sourcePixelWidth: extraction.sourcePixelWidth ?? null,
        sourcePixelHeight: extraction.sourcePixelHeight ?? null,
        rasterPixelWidth: extraction.rasterPixelWidth ?? null,
        rasterPixelHeight: extraction.rasterPixelHeight ?? null,
        sourceWidthMeters: extraction.sourceWidthMeters ?? null,
        sourceHeightMeters: extraction.sourceHeightMeters ?? null,
      },
      evidence: {
        rawPairCount: evidence.rawPairCount ?? null,
        consolidatedPairCount: evidence.consolidatedPairCount ?? null,
        consolidationClusterCount: evidence.consolidationClusterCount ?? null,
        retainedPairCount: evidence.retainedPairCount ?? null,
        explicitWallSystemCount: evidence.explicitWallSystemCount ?? null,
      },
      familyAgreement: countSummary(root.familyAgreement),
      noAgreementGapDiagnostic: diagnosticCounts(root.noAgreementGapDiagnostic),
      rasterPairingGapDiagnostic: diagnosticCounts(root.rasterPairingGapDiagnostic),
      noMatchingRasterStageDiagnostic: diagnosticCounts(root.noMatchingRasterStageDiagnostic),
      rasterDedupeGapDiagnostic: diagnosticCounts(root.rasterDedupeGapDiagnostic),
      rasterDedupePreservationSimulation: simulationSummary(root.rasterDedupePreservationSimulation),
      safety: {
        writesPerformed: safety.writesPerformed ?? null,
        sourceSelectionChanged: safety.sourceSelectionChanged ?? null,
        canonicalGeometryChanged: safety.canonicalGeometryChanged ?? null,
        generated3d: safety.generated3d ?? null,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to summarize Blueprint source-family audit." }, { status: 400 });
  }
}
