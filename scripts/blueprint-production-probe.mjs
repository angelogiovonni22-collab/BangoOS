const url = "https://bango-os.vercel.app/api/blueprints/e25bd50e-6cf0-4db5-9a09-4d303e3c8987/engine-benchmark?expectedPage=1&run=604";
const response = await fetch(url, { signal: AbortSignal.timeout(120_000), headers: { "user-agent": "BangoOS-Blueprint-Production-Probe" } });
console.log(`A4 production probe HTTP ${response.status}`);
const text = await response.text();
if (!response.ok) {
  console.log(text.slice(0, 1000));
  process.exit(1);
}
const body = JSON.parse(text);
const stages = body?.rasterEvidence?.stages || {};
console.log(JSON.stringify({
  selectedPage: body?.candidate?.selectedPage,
  matchedDimensionCount: stages.matchedDimensionCount,
  boundarySpanDimensionCount: stages.boundarySpanDimensionCount,
  unresolvedDimensionCount: stages.unresolvedDimensionCount,
  sourceDimensionEvidenceMatchedCount: stages.sourceDimensionEvidenceMatchedCount,
  globalBoundaryDiagnosticCounts: stages.globalBoundaryDiagnosticCounts,
  missingBoundaryRecoveredBeforeSelectionCount: stages.missingBoundaryRecoveredBeforeSelectionCount,
  missingBoundaryAbsentExplicitCount: stages.missingBoundaryAbsentExplicitCount,
  missingBoundaryProvenance: stages.missingBoundaryProvenance,
  predictedPrecision: body?.sourcePixelOverlay?.predictedPrecision,
  canonicalGeometryChanged: body?.writeSafety?.canonicalGeometryChanged,
  writesPerformed: body?.writeSafety?.writesPerformed,
  generated3d: body?.writeSafety?.generated3d,
}, null, 2));
