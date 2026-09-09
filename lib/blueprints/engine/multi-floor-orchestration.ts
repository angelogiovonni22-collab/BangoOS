import type { BosBuildingGraph, BosLevel } from "./building-graph";
import { assembleMultiFloorBuildingGraph, type BosLevelAlignment } from "./multi-floor";

const DEFAULT_LEVEL_HEIGHT_METERS = 3.048;

export type BosLevelSheetCandidate = {
  sheetId: string;
  versionId: string;
  sheetNumber: string;
  title: string;
  discipline: string;
  levelIndex: number;
  levelName: string;
  elevation: number;
};

export type BosMultiFloorAlignmentValidation = {
  valid: boolean;
  issues: string[];
  minimumConfidence: number;
};

function normalized(value: string) {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function levelDescriptor(sheetNumber: string, title: string) {
  const value = normalized(`${sheetNumber} ${title}`);
  if (/\b(roof|elevation|section|detail|foundation|footing|reflected ceiling|rcp)\b/.test(value)) return null;
  if (/\b(basement|cellar)\b/.test(value)) return { index: -1, name: "Basement" };
  if (/\b(lower level|lower floor)\b/.test(value)) return { index: -1, name: "Lower Level" };
  if (/\b(first|1st|ground|main)\s+(floor|level)\b/.test(value) || /\b(first|1st)\s+floor\s+plan\b/.test(value)) return { index: 0, name: "First Floor" };
  if (/\b(second|2nd)\s+(floor|level)\b/.test(value)) return { index: 1, name: "Second Floor" };
  if (/\b(third|3rd)\s+(floor|level)\b/.test(value)) return { index: 2, name: "Third Floor" };
  if (/\b(fourth|4th)\s+(floor|level)\b/.test(value)) return { index: 3, name: "Fourth Floor" };
  if (/\b(fifth|5th)\s+(floor|level)\b/.test(value)) return { index: 4, name: "Fifth Floor" };
  const numbered = value.match(/\b(?:floor|level)\s*(\d{1,2})\b/);
  if (numbered) {
    const human = Number(numbered[1]);
    if (Number.isInteger(human) && human >= 1 && human <= 40) return { index: human - 1, name: `Level ${human}` };
  }
  return null;
}

export function discoverBlueprintLevelSheets(input: Array<{
  sheetId: string;
  versionId: string;
  sheetNumber: string;
  title: string;
  discipline: string;
}>): BosLevelSheetCandidate[] {
  const candidates = input.flatMap((sheet) => {
    const discipline = normalized(sheet.discipline);
    if (discipline && !discipline.includes("architect")) return [];
    const descriptor = levelDescriptor(sheet.sheetNumber, sheet.title);
    if (!descriptor) return [];
    return [{
      ...sheet,
      levelIndex: descriptor.index,
      levelName: descriptor.name,
      elevation: descriptor.index * DEFAULT_LEVEL_HEIGHT_METERS,
    } satisfies BosLevelSheetCandidate];
  }).sort((a, b) => a.levelIndex - b.levelIndex || a.sheetNumber.localeCompare(b.sheetNumber));

  const unique = new Map<number, BosLevelSheetCandidate>();
  for (const candidate of candidates) if (!unique.has(candidate.levelIndex)) unique.set(candidate.levelIndex, candidate);
  return [...unique.values()].sort((a, b) => a.levelIndex - b.levelIndex);
}

function levelId(candidate: BosLevelSheetCandidate) {
  return candidate.levelIndex < 0 ? `level-basement-${Math.abs(candidate.levelIndex)}` : `level-${candidate.levelIndex + 1}`;
}

export function bindGraphToDiscoveredLevel(graph: BosBuildingGraph, candidate: BosLevelSheetCandidate): { graph: BosBuildingGraph; level: BosLevel } {
  const id = levelId(candidate);
  const sourcePage = graph.metadata.sourcePage || graph.levels[0]?.sourcePage || 1;
  const level: BosLevel = {
    id,
    name: candidate.levelName,
    index: candidate.levelIndex,
    elevation: candidate.elevation,
    sourcePage,
    sourceSheetNumber: candidate.sheetNumber,
    sourceSheetTitle: candidate.title,
  };
  const clone = structuredClone(graph);
  clone.levels = [level];
  clone.walls = clone.walls.map((item) => ({ ...item, levelId: id }));
  clone.openings = clone.openings.map((item) => ({ ...item, levelId: id }));
  clone.doors = clone.doors.map((item) => ({ ...item, levelId: id }));
  clone.windows = clone.windows.map((item) => ({ ...item, levelId: id }));
  clone.rooms = clone.rooms.map((item) => ({ ...item, levelId: id }));
  clone.stairs = clone.stairs.map((item) => ({ ...item, levelId: id }));
  clone.slabs = clone.slabs.map((item) => ({ ...item, levelId: id }));
  clone.decksPorches = clone.decksPorches.map((item) => ({ ...item, levelId: id }));
  clone.dimensions = clone.dimensions.map((item) => ({ ...item, levelId: id }));
  clone.metadata.sourceSheetNumber = candidate.sheetNumber;
  clone.metadata.sourceSheetTitle = candidate.title;
  return { graph: clone, level };
}

function graphSpan(graph: BosBuildingGraph) {
  if (!graph.walls.length) return 0;
  const xs = graph.walls.flatMap((wall) => [wall.centerline.start.x, wall.centerline.end.x]);
  const ys = graph.walls.flatMap((wall) => [wall.centerline.start.y, wall.centerline.end.y]);
  return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

export function validateMultiFloorAlignments(graphs: BosBuildingGraph[], alignments: BosLevelAlignment[]): BosMultiFloorAlignmentValidation {
  const issues: string[] = [];
  const minimumConfidence = alignments.length ? Math.min(...alignments.map((item) => item.confidence)) : 0;
  if (graphs.length < 2) issues.push("At least two validated floor graphs are required for multi-floor assembly.");
  if (alignments.length !== graphs.length) issues.push("Every reconstructed floor must have an alignment record.");
  if (minimumConfidence < 0.55) issues.push("One or more floor alignments are below the B.O.S. confidence threshold.");
  const indices = graphs.flatMap((graph) => graph.levels.map((level) => level.index));
  if (new Set(indices).size !== indices.length) issues.push("Duplicate floor indices must be resolved before multi-floor assembly.");
  if (graphs.some((graph) => graph.validation.status !== "reconstructed")) issues.push("Every floor must pass native reconstruction validation before assembly.");
  if (graphs.some((graph) => !graph.levels[0]?.sourceSheetNumber || !graph.levels[0]?.sourceSheetTitle)) issues.push("Every floor must retain source sheet provenance.");

  const baseSpan = Math.max(1, ...graphs.map(graphSpan));
  for (const alignment of alignments) {
    const translation = Math.hypot(alignment.translation.x, alignment.translation.y);
    if (alignment.anchor !== "manual" && translation > baseSpan * 1.5) {
      issues.push(`${alignment.levelId} requires an implausibly large automatic translation and must be reviewed.`);
    }
  }
  return { valid: issues.length === 0, issues, minimumConfidence };
}

export function assembleValidatedMultiFloorGraph(input: Array<{ graph: BosBuildingGraph; candidate: BosLevelSheetCandidate; manualTranslation?: { x: number; y: number } }>) {
  const bound = input.map((item) => ({ ...bindGraphToDiscoveredLevel(item.graph, item.candidate), manualTranslation: item.manualTranslation }));
  const assembled = assembleMultiFloorBuildingGraph(bound.map((item) => ({ graph: item.graph, level: item.level, manualTranslation: item.manualTranslation })));
  const validation = validateMultiFloorAlignments(bound.map((item) => item.graph), assembled.alignments);
  assembled.graph.metadata.algorithms = { ...assembled.graph.metadata.algorithms, levelDiscovery: "sheet-metadata-1.0.0", levelAssembly: "validated-multifloor-1.0.0" };
  assembled.graph.confidence = Math.min(assembled.graph.confidence, validation.minimumConfidence || assembled.graph.confidence);
  if (!validation.valid) {
    assembled.graph.validation = {
      ...assembled.graph.validation,
      status: "needs_review",
      score: Math.min(assembled.graph.validation.score, 0.69),
      issues: [
        ...assembled.graph.validation.issues,
        ...validation.issues.map((message, index) => ({ id: `multifloor-${index + 1}`, code: "multifloor_alignment", severity: "warning" as const, message })),
      ],
    };
  }
  return { ...assembled, alignmentValidation: validation };
}

export function selectMultiFloorLevel(graph: BosBuildingGraph, levelId: string | null) {
  if (!levelId) return graph;
  if (!graph.levels.some((level) => level.id === levelId)) throw new Error("Requested Blueprint level was not found in the assembled graph.");
  const clone = structuredClone(graph);
  clone.levels = clone.levels.filter((level) => level.id === levelId);
  clone.walls = clone.walls.filter((item) => item.levelId === levelId);
  clone.openings = clone.openings.filter((item) => item.levelId === levelId);
  clone.doors = clone.doors.filter((item) => item.levelId === levelId);
  clone.windows = clone.windows.filter((item) => item.levelId === levelId);
  clone.rooms = clone.rooms.filter((item) => item.levelId === levelId);
  clone.stairs = clone.stairs.filter((item) => item.levelId === levelId);
  clone.slabs = clone.slabs.filter((item) => item.levelId === levelId);
  clone.decksPorches = clone.decksPorches.filter((item) => item.levelId === levelId);
  clone.dimensions = clone.dimensions.filter((item) => item.levelId === levelId);
  return clone;
}
