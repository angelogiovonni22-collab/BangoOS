export type BlueprintInferenceEvidence = {
  source: "raster" | "vector" | "dimension" | "model";
  page: number;
  confidence: number;
  model?: string | null;
};

export type BlueprintInferenceResponse = {
  protocol_version: "bos-blueprint-inference-v1";
  source_version_id: string;
  source_page: number;
  walls: Array<{
    start: [number, number];
    end: [number, number];
    thickness_m?: number | null;
    confidence: number;
    evidence: BlueprintInferenceEvidence[];
  }>;
  rooms: Array<{
    points: Array<[number, number]>;
    label?: string | null;
    confidence: number;
    evidence: BlueprintInferenceEvidence[];
  }>;
  openings: Array<{
    kind: "door" | "window" | "opening";
    center: [number, number];
    width_m?: number | null;
    confidence: number;
    evidence: BlueprintInferenceEvidence[];
  }>;
  model_runs: Array<{
    capability: string;
    model: string;
    model_version: string;
    status: "succeeded" | "unavailable" | "failed";
    latency_ms: number;
    confidence?: number | null;
    detail?: string | null;
  }>;
  consensus_confidence: number;
  warnings: string[];
};

type BlueprintInferenceRequest = {
  companyId: string;
  projectId?: string | null;
  sourceVersionId: string;
  sourcePage: number;
  imageUrl: string;
  drawingUnitsPerMeter?: number | null;
};

function configuredEndpoint() {
  const raw = process.env.BOS_BLUEPRINT_INFERENCE_URL?.trim();
  return raw ? raw.replace(/\/$/, "") : null;
}

function configuredToken() {
  return process.env.BOS_BLUEPRINT_INFERENCE_TOKEN?.trim() || null;
}

function isFinitePoint(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

function validEvidence(value: unknown): value is BlueprintInferenceEvidence {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<BlueprintInferenceEvidence>;
  return ["raster", "vector", "dimension", "model"].includes(String(item.source)) &&
    typeof item.page === "number" && item.page >= 1 &&
    typeof item.confidence === "number" && item.confidence >= 0 && item.confidence <= 1;
}

export function validateBlueprintInferenceResponse(value: unknown): value is BlueprintInferenceResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Partial<BlueprintInferenceResponse>;
  if (response.protocol_version !== "bos-blueprint-inference-v1") return false;
  if (typeof response.source_version_id !== "string" || typeof response.source_page !== "number") return false;
  if (typeof response.consensus_confidence !== "number" || response.consensus_confidence < 0 || response.consensus_confidence > 1) return false;
  if (!Array.isArray(response.walls) || !Array.isArray(response.rooms) || !Array.isArray(response.openings) || !Array.isArray(response.model_runs) || !Array.isArray(response.warnings)) return false;

  const evidenced = (items: Array<{ evidence?: unknown }>) => items.every((item) => Array.isArray(item.evidence) && item.evidence.length > 0 && item.evidence.every(validEvidence));
  if (!evidenced(response.walls) || !evidenced(response.rooms) || !evidenced(response.openings)) return false;
  if (!response.walls.every((wall) => isFinitePoint(wall.start) && isFinitePoint(wall.end) && typeof wall.confidence === "number")) return false;
  if (!response.rooms.every((room) => Array.isArray(room.points) && room.points.length >= 3 && room.points.every(isFinitePoint) && typeof room.confidence === "number")) return false;
  if (!response.openings.every((opening) => isFinitePoint(opening.center) && ["door", "window", "opening"].includes(opening.kind) && typeof opening.confidence === "number")) return false;
  return true;
}

/**
 * Requests learned floor-plan proposals. This is deliberately optional and fail-open:
 * deterministic B.O.S. reconstruction remains available when the GPU service is absent.
 */
export async function requestBlueprintLearnedInference(input: BlueprintInferenceRequest): Promise<BlueprintInferenceResponse | null> {
  const endpoint = configuredEndpoint();
  const token = configuredToken();
  if (!endpoint || !token) return null;

  try {
    const response = await fetch(`${endpoint}/v1/infer`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-bos-inference-token": token,
      },
      body: JSON.stringify({
        company_id: input.companyId,
        project_id: input.projectId || null,
        source_version_id: input.sourceVersionId,
        source_page: input.sourcePage,
        image_url: input.imageUrl,
        drawing_units_per_meter: input.drawingUnitsPerMeter || null,
        requested_capabilities: ["room_polygons", "wall_mask", "wall_edges", "openings", "segmentation"],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    return validateBlueprintInferenceResponse(payload) ? payload : null;
  } catch {
    return null;
  }
}
