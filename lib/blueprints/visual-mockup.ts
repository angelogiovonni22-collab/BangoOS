import type { BosBuildingGraph } from "./engine/building-graph";

export const BLUEPRINT_VISUAL_PROMPT_VERSION = "bos-blueprint-visual-v1";
export const BLUEPRINT_VISUAL_DISCLAIMER = "Conceptual AI visualization — verify against the source plans before construction use.";

export type BlueprintVisualOptions = {
  furnished: boolean;
  style: "architectural" | "warm-modern" | "monochrome";
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
    "Create one polished roofless elevated isometric architectural visualization from the attached authoritative blueprint page.",
    `Authoritative registered sheet: ${input.sheetIdentity}; selected source page: ${input.sourcePage}. Preserve the blueprint orientation and show the entire footprint.`,
    `Presentation: ${style}; ${input.options.furnished ? "restrained furnishings only where they help communicate scale" : "unfurnished interiors"}; neutral dark B.O.S. presentation background.`,
    "Preserve connected walls, coherent enclosed rooms, consistent wall thickness, attached garage, deck/porch, stairs/core, doors, windows, kitchen and fireplace only where supported by the source.",
    "Do not invent another floor, building wing, room, opening, furnishing layout, or unsupported architectural feature. No disconnected or floating walls.",
    "No roof, labels, dimensions, people, logo, watermark, title block, callouts, legend, or surrounding blueprint sheet in the result.",
    "This is presentation imagery, not authoritative geometry. The blueprint image overrides any uncertain or conflicting structured context.",
    graphContext ? `Existing B.O.S. Building Graph and verified correction context (supporting evidence only): ${JSON.stringify(graphContext)}.` : "No verified Building Graph context is available; rely only on the attached selected source page.",
  ].join("\n");
}

export async function generateBlueprintVisual(input: { sourceImage: Buffer; sourceMimeType: "image/png" | "image/jpeg" | "image/webp"; prompt: string }) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("AI Visual Mockup generation is not configured on this deployment.");
  const model = process.env.BANGO_BLUEPRINT_VISUAL_MODEL?.trim() || "gpt-image-1.5";
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", input.prompt);
  form.append("image", new Blob([new Uint8Array(input.sourceImage)], { type: input.sourceMimeType }), `selected-blueprint-page.${input.sourceMimeType.split("/")[1]}`);
  form.append("size", "1536x1024");
  form.append("quality", "high");
  form.append("output_format", "png");
  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(110_000),
  });
  const payload = await response.json() as { data?: Array<{ b64_json?: string }>; error?: { message?: string } };
  if (!response.ok) throw new Error(`The visual-generation provider could not complete the request (${response.status}).`);
  const encoded = payload.data?.[0]?.b64_json;
  if (!encoded) throw new Error("The visual-generation provider returned no image.");
  return { image: Buffer.from(encoded, "base64"), model, provider: "openai" };
}
