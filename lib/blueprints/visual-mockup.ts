import { randomUUID } from "node:crypto";
import { recordBosIntelligenceUsageEvent } from "@/lib/billing/intelligence-usage-events";
import type { BosBuildingGraph } from "./engine/building-graph";

export const BLUEPRINT_VISUAL_PROMPT_VERSION = "bos-blueprint-visual-v2-geometry-lock";
export const BLUEPRINT_VISUAL_DISCLAIMER = "Conceptual AI visualization — verify against the source plans before construction use.";

export type BlueprintVisualOptions = {
  furnished: boolean;
  style: "architectural" | "warm-modern" | "monochrome";
};

type BlueprintVisualTelemetry = {
  companyId: string;
  actorUserId?: string | null;
  sourceVersionId?: string | null;
};

export function normalizeBlueprintVisualOptions(value: unknown): BlueprintVisualOptions {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  if (input.furnished !== undefined && typeof input.furnished !== "boolean") throw new Error("Invalid visual mockup options: furnished must be true or false.");
  if (input.style !== undefined && !["architectural", "warm-modern", "monochrome"].includes(String(input.style))) throw new Error("Invalid visual mockup options: unsupported presentation style.");
  const style = input.style === "warm-modern" || input.style === "monochrome" ? input.style : "architectural";
  return { furnished: input.furnished !== false, style };
}

export function summarizeBlueprintGraph(graph: BosBuildingGraph | null, correctionCount = 0) {
  if (!graph) return null;
  const points = graph.walls.flatMap((wall) => [wall.centerline.start, wall.centerline.end]);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const width = xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
  const depth = ys.length ? Math.max(...ys) - Math.min(...ys) : 0;
  return {
    sourcePage: graph.metadata.sourcePage,
    validationStatus: graph.validation.status,
    validationScore: graph.validation.score,
    wallCount: graph.walls.length,
    exteriorWallCount: graph.walls.filter((wall) => wall.type === "exterior").length,
    rooms: graph.rooms.map((room) => room.name || room.id).slice(0, 80),
    garagePresent: graph.rooms.some((room) => /garage/i.test(room.name || "")),
    deckPorchPresent: graph.decksPorches.length > 0,
    stairPresent: graph.stairs.length > 0,
    openingCount: graph.openings.length,
    footprintOrientation: width >= depth ? "landscape" : "portrait",
    footprintMeters: { width, depth },
    correctionCount,
  };
}

export type BlueprintWallDistance = {
  wallId: string;
  label: string;
  type: "exterior" | "interior" | "unknown";
  lengthMeters: number;
  lengthImperial: string;
};

function wallLengthMeters(wall: BosBuildingGraph["walls"][number]) {
  return Math.hypot(
    wall.centerline.end.x - wall.centerline.start.x,
    wall.centerline.end.y - wall.centerline.start.y,
  );
}

export function formatMetersAsFeetInches(meters: number) {
  const totalInches = Math.max(0, Math.round(meters * 39.3700787402));
  return `${Math.floor(totalInches / 12)}′ ${totalInches % 12}″`;
}

export function buildBlueprintWallDistanceSchedule(graph: BosBuildingGraph | null) {
  const scaleTrusted = Boolean(
    graph
    && graph.validation.status === "reconstructed"
    && graph.validation.metrics.scaleConfidence >= 0.9
    && graph.scale.source !== "unknown"
    && graph.scale.confidence >= 0.9,
  );
  if (!graph || !scaleTrusted) {
    return {
      available: false as const,
      unit: "ft-in" as const,
      reason: "Wall distances are unavailable until the blueprint scale passes verification.",
      walls: [] as BlueprintWallDistance[],
    };
  }
  const counts = { exterior: 0, interior: 0, unknown: 0 };
  const walls = graph.walls
    .map((wall) => {
      counts[wall.type] += 1;
      const lengthMeters = wallLengthMeters(wall);
      return {
        wallId: wall.id,
        label: `${wall.type === "unknown" ? "Wall" : `${wall.type[0].toUpperCase()}${wall.type.slice(1)} wall`} ${counts[wall.type]}`,
        type: wall.type,
        lengthMeters: Math.round(lengthMeters * 1000) / 1000,
        lengthImperial: formatMetersAsFeetInches(lengthMeters),
      } satisfies BlueprintWallDistance;
    })
    .filter((wall) => wall.lengthMeters > 0)
    .sort((left, right) => {
      const rank = { exterior: 0, interior: 1, unknown: 2 };
      return rank[left.type] - rank[right.type] || left.label.localeCompare(right.label, undefined, { numeric: true });
    });
  return { available: true as const, unit: "ft-in" as const, reason: null, walls };
}

export function buildBlueprintVisualPrompt(input: {
  sheetIdentity: string;
  sourcePage: number;
  options: BlueprintVisualOptions;
  graph: BosBuildingGraph | null;
  correctionCount?: number;
}) {
  const graphContext = summarizeBlueprintGraph(input.graph, input.correctionCount);
  const style = input.options.style === "warm-modern"
    ? "warm modern residential materials"
    : input.options.style === "monochrome"
      ? "refined monochrome architectural model materials"
      : "neutral professional architectural materials";
  return [
    "Create one polished roofless elevated isometric architectural visualization using both attached images.",
    "Image 1 is the authoritative source plan. Image 2 is the B.O.S. geometry lock reconstructed and validated from that plan.",
    `Authoritative registered sheet: ${input.sheetIdentity}; selected source page: ${input.sourcePage}. Preserve the blueprint orientation and show the entire footprint.`,
    `Presentation: ${style}; ${input.options.furnished ? "restrained furnishings only where they help communicate scale" : "unfurnished interiors"}; neutral dark B.O.S. presentation background.`,
    "Preserve connected walls, coherent enclosed rooms, consistent wall thickness, attached garage, deck/porch, stairs/core, doors, windows, kitchen and fireplace only where supported by the source.",
    "Do not invent another floor, building wing, room, opening, furnishing layout, or unsupported architectural feature. No disconnected or floating walls.",
    "No roof, labels, dimensions, people, logo, watermark, title block, callouts, legend, or surrounding blueprint sheet in the result.",
    "NON-NEGOTIABLE GEOMETRY LOCK: preserve every wall endpoint, wall connection, footprint edge, opening position, room boundary, stair and deck/porch shown in Image 2. Change appearance only. If styling conflicts with geometry, geometry wins.",
    "This is presentation imagery, not authoritative geometry. Image 1 resolves source meaning; Image 2 controls exact structure.",
    graphContext ? `Existing B.O.S. Building Graph and verified correction context (supporting evidence only): ${JSON.stringify(graphContext)}.` : "No verified Building Graph context is available; rely only on the attached selected source page.",
  ].join("\n");
}

export async function generateBlueprintVisual(input: {
  sourceImage: Buffer;
  sourceMimeType: "image/png" | "image/jpeg" | "image/webp";
  geometryLockImage: Buffer;
  prompt: string;
  telemetry?: BlueprintVisualTelemetry;
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("AI Visual Mockup generation is not configured on this deployment.");
  const model = process.env.BANGO_BLUEPRINT_VISUAL_MODEL?.trim() || "gpt-image-2.5-sunburst";
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", input.prompt);
  form.append("image", new Blob([new Uint8Array(input.sourceImage)], { type: input.sourceMimeType }), `selected-blueprint-page.${input.sourceMimeType.split("/")[1]}`);
  form.append("image", new Blob([new Uint8Array(input.geometryLockImage)], { type: "image/png" }), "bos-geometry-lock.png");
  form.append("input_fidelity", "high");
  form.append("size", "1536x1024");
  form.append("quality", "high");
  form.append("output_format", "png");

  const operationKey = `blueprint-visual-${randomUUID()}`;
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(110_000),
    });
  } catch (error) {
    if (input.telemetry) {
      await recordBosIntelligenceUsageEvent({
        companyId: input.telemetry.companyId,
        actorUserId: input.telemetry.actorUserId,
        product: "blueprint_visual_mockup",
        outcome: "provider_failed",
        operationKey,
        provider: "openai",
        providerModel: model,
        sourceType: "blueprint_version",
        sourceId: input.telemetry.sourceVersionId,
        metadata: { providerCostStatus: "unpriced", failureStage: "request" },
      });
    }
    throw error;
  }

  const providerRequestId = response.headers.get("x-request-id");
  const payload = await response.json() as { data?: Array<{ b64_json?: string }>; error?: { message?: string } };
  if (!response.ok) {
    if (input.telemetry) {
      await recordBosIntelligenceUsageEvent({
        companyId: input.telemetry.companyId,
        actorUserId: input.telemetry.actorUserId,
        product: "blueprint_visual_mockup",
        outcome: "provider_failed",
        operationKey,
        provider: "openai",
        providerModel: model,
        providerRequestId,
        sourceType: "blueprint_version",
        sourceId: input.telemetry.sourceVersionId,
        metadata: { providerCostStatus: "unpriced", providerStatus: response.status },
      });
    }
    throw new Error(`The visual-generation provider could not complete the request (${response.status}).`);
  }

  const encoded = payload.data?.[0]?.b64_json;
  if (!encoded) {
    if (input.telemetry) {
      await recordBosIntelligenceUsageEvent({
        companyId: input.telemetry.companyId,
        actorUserId: input.telemetry.actorUserId,
        product: "blueprint_visual_mockup",
        outcome: "provider_failed",
        operationKey,
        provider: "openai",
        providerModel: model,
        providerRequestId,
        sourceType: "blueprint_version",
        sourceId: input.telemetry.sourceVersionId,
        metadata: { providerCostStatus: "unpriced", failureStage: "empty_output" },
      });
    }
    throw new Error("The visual-generation provider returned no image.");
  }

  if (input.telemetry) {
    await recordBosIntelligenceUsageEvent({
      companyId: input.telemetry.companyId,
      actorUserId: input.telemetry.actorUserId,
      product: "blueprint_visual_mockup",
      outcome: "succeeded",
      operationKey,
      provider: "openai",
      providerModel: model,
      providerRequestId,
      sourceType: "blueprint_version",
      sourceId: input.telemetry.sourceVersionId,
      metadata: { providerCostStatus: "unpriced", outputFormat: "png", quality: "high", size: "1536x1024" },
    });
  }

  return { image: Buffer.from(encoded, "base64"), model, provider: "openai", providerRequestId };
}
