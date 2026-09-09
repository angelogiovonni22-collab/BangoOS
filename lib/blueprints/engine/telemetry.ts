export type BosBlueprintTelemetryEvent = {
  event: "generation_started" | "generation_ready" | "generation_withheld" | "generation_failed" | "benchmark_result";
  companyId?: string;
  projectId?: string;
  sourceVersionId?: string;
  engineStatus?: string;
  reconstructionVersion?: string | null;
  confidence?: number | null;
  validationScore?: number | null;
  validationStatus?: string | null;
  failureCodes?: string[];
  wallCount?: number;
  levelCount?: number;
  durationMs?: number;
  extra?: Record<string, string | number | boolean | null>;
};

function finite(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeBlueprintTelemetryEvent(input: BosBlueprintTelemetryEvent) {
  return {
    product: "B.O.S.",
    subsystem: "native-blueprint-engine",
    timestamp: new Date().toISOString(),
    event: input.event,
    companyId: input.companyId || null,
    projectId: input.projectId || null,
    sourceVersionId: input.sourceVersionId || null,
    engineStatus: input.engineStatus || null,
    reconstructionVersion: input.reconstructionVersion || null,
    confidence: finite(input.confidence),
    validationScore: finite(input.validationScore),
    validationStatus: input.validationStatus || null,
    failureCodes: [...new Set(input.failureCodes || [])].slice(0, 25),
    wallCount: finite(input.wallCount),
    levelCount: finite(input.levelCount),
    durationMs: finite(input.durationMs),
    extra: input.extra || {},
  };
}

export function emitBlueprintTelemetry(input: BosBlueprintTelemetryEvent) {
  const event = normalizeBlueprintTelemetryEvent(input);
  // Structured server log is intentionally provider-neutral. Vercel runtime logs can ingest this
  // immediately, and a future durable analytics sink can consume the same stable contract.
  console.info("BOS_BLUEPRINT_ENGINE", JSON.stringify(event));
  return event;
}
