import type { BosWallSystemCandidate } from "./wall-system-builder";

export type BosRasterSheetFrameSelection = {
  wallSystems: BosWallSystemCandidate[];
  rejectedSystemIds: string[];
  diagnostics: string[];
};

export function excludeRasterSheetFrameSystems(
  input: readonly BosWallSystemCandidate[],
  sourceWidthMeters?: number | null,
  sourceHeightMeters?: number | null,
): BosRasterSheetFrameSelection {
  if (!(sourceWidthMeters && sourceWidthMeters > 0) || !(sourceHeightMeters && sourceHeightMeters > 0)) {
    return {
      wallSystems: [...input],
      rejectedSystemIds: [],
      diagnostics: ["Raster sheet-frame exclusion skipped because source page dimensions were unavailable."],
    };
  }

  const edgeRatio = 0.07;
  const minSpanRatio = 0.55;
  const rejected = new Set<string>();

  for (const system of input) {
    const line = system.centerline;
    const dx = Math.abs(line.end.x - line.start.x);
    const dy = Math.abs(line.end.y - line.start.y);
    const horizontal = dx >= dy;
    if (horizontal) {
      const y = (line.start.y + line.end.y) / 2;
      const nearPageEdge = y <= sourceHeightMeters * edgeRatio || y >= sourceHeightMeters * (1 - edgeRatio);
      const spansSheet = system.length >= sourceWidthMeters * minSpanRatio;
      if (nearPageEdge && spansSheet) rejected.add(system.id);
    } else {
      const x = (line.start.x + line.end.x) / 2;
      const nearPageEdge = x <= sourceWidthMeters * edgeRatio || x >= sourceWidthMeters * (1 - edgeRatio);
      const spansSheet = system.length >= sourceHeightMeters * minSpanRatio;
      if (nearPageEdge && spansSheet) rejected.add(system.id);
    }
  }

  return {
    wallSystems: input.filter((system) => !rejected.has(system.id)),
    rejectedSystemIds: [...rejected],
    diagnostics: [
      `Raster sheet-frame exclusion rejected ${rejected.size} long wall-like systems near the drawing perimeter.`,
      "Sheet-frame exclusion requires both page-edge proximity and majority-page span; ordinary exterior building walls are not rejected by edge proximity alone.",
    ],
  };
}
