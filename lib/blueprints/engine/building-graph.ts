export type BosLengthUnit = "m";
export type BosSourceKind = "pdf_vector" | "pdf_text" | "raster" | "ai" | "manual" | "derived";
export type BosConfidence = number;

export type BosPoint2 = { x: number; y: number };
export type BosPoint3 = { x: number; y: number; z: number };
export type BosLine2 = { start: BosPoint2; end: BosPoint2 };
export type BosPolygon2 = { points: BosPoint2[] };

export type BosSourceEvidence = {
  id: string;
  page: number;
  kind: BosSourceKind;
  bbox?: { x: number; y: number; width: number; height: number };
  text?: string;
  sourceObjectId?: string;
  score?: number;
};

export type BosProvenance = {
  createdBy: "deterministic" | "ai_assisted" | "manual";
  algorithm: string;
  algorithmVersion: string;
  evidenceIds: string[];
};

export type BosCorrectionState = {
  corrected: boolean;
  correctionId?: string;
  correctedAt?: string;
  correctedBy?: string;
};

export type BosGraphObjectBase = {
  id: string;
  levelId: string;
  confidence: BosConfidence;
  sourcePage: number;
  evidence: BosSourceEvidence[];
  provenance: BosProvenance;
  correction?: BosCorrectionState;
};

export type BosWallType = "exterior" | "interior" | "unknown";
export type BosWall = BosGraphObjectBase & {
  type: BosWallType;
  centerline: BosLine2;
  thickness: number;
  height: number;
  loadBearing?: boolean;
};

export type BosOpeningType = "door" | "window" | "passage" | "unknown";
export type BosOpening = BosGraphObjectBase & {
  type: BosOpeningType;
  wallId: string;
  offset: number;
  width: number;
  height: number;
  sillHeight?: number;
};

export type BosDoor = BosOpening & {
  type: "door";
  swing?: "left" | "right" | "double" | "sliding" | "unknown";
};

export type BosWindow = BosOpening & {
  type: "window";
  style?: string;
};

export type BosRoom = BosGraphObjectBase & {
  type: "room";
  name?: string;
  polygon: BosPolygon2;
  area?: number;
};

export type BosStair = BosGraphObjectBase & {
  type: "stair";
  polygon: BosPolygon2;
  direction?: "up" | "down" | "unknown";
  targetLevelId?: string;
};

export type BosSlab = BosGraphObjectBase & {
  type: "floor" | "foundation" | "deck" | "porch";
  polygon: BosPolygon2;
  thickness: number;
  elevation: number;
};

export type BosDimension = {
  id: string;
  levelId: string;
  page: number;
  start?: BosPoint2;
  end?: BosPoint2;
  value: number;
  unit: BosLengthUnit;
  rawText?: string;
  confidence: BosConfidence;
  evidence: BosSourceEvidence[];
};

export type BosScale = {
  source: "printed" | "dimension_solved" | "manual" | "unknown";
  drawingUnitsPerMeter: number | null;
  printedLabel?: string;
  confidence: BosConfidence;
};

export type BosLevel = {
  id: string;
  name: string;
  index: number;
  elevation: number;
  sourcePage: number;
  sourceSheetNumber?: string;
  sourceSheetTitle?: string;
};

export type BosValidationSeverity = "info" | "warning" | "error";
export type BosValidationIssue = {
  id: string;
  code: string;
  severity: BosValidationSeverity;
  message: string;
  objectIds?: string[];
  evidenceIds?: string[];
};

export type BosValidationReport = {
  version: 1;
  score: number;
  status: "reconstructed" | "needs_review" | "needs_input" | "failed";
  metrics: {
    exteriorClosure: number;
    footprintComplexity: number;
    wallTopology: number;
    scaleConfidence: number;
    semanticCoverage: number;
  };
  issues: BosValidationIssue[];
};

export type BosBuildingGraph = {
  schemaVersion: 1;
  reconstructionVersion: string;
  units: BosLengthUnit;
  building: {
    id: string;
    companyId?: string;
    projectId?: string;
    sourceVersionId?: string;
    name?: string;
  };
  levels: BosLevel[];
  walls: BosWall[];
  openings: BosOpening[];
  doors: BosDoor[];
  windows: BosWindow[];
  rooms: BosRoom[];
  stairs: BosStair[];
  slabs: BosSlab[];
  decksPorches: BosSlab[];
  dimensions: BosDimension[];
  scale: BosScale;
  sourceEvidence: BosSourceEvidence[];
  confidence: BosConfidence;
  validation: BosValidationReport;
  metadata: {
    createdAt: string;
    sourcePage: number;
    sourceSheetNumber?: string;
    sourceSheetTitle?: string;
    algorithms: Record<string, string>;
  };
};

export function clampBosConfidence(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function createEmptyBosBuildingGraph(input: {
  buildingId: string;
  sourcePage: number;
  levelName?: string;
  sourceSheetNumber?: string;
  sourceSheetTitle?: string;
}): BosBuildingGraph {
  const levelId = "level-1";
  return {
    schemaVersion: 1,
    reconstructionVersion: "native-1",
    units: "m",
    building: { id: input.buildingId },
    levels: [{
      id: levelId,
      name: input.levelName || "Level 1",
      index: 0,
      elevation: 0,
      sourcePage: input.sourcePage,
      sourceSheetNumber: input.sourceSheetNumber,
      sourceSheetTitle: input.sourceSheetTitle,
    }],
    walls: [],
    openings: [],
    doors: [],
    windows: [],
    rooms: [],
    stairs: [],
    slabs: [],
    decksPorches: [],
    dimensions: [],
    scale: { source: "unknown", drawingUnitsPerMeter: null, confidence: 0 },
    sourceEvidence: [],
    confidence: 0,
    validation: {
      version: 1,
      score: 0,
      status: "needs_input",
      metrics: { exteriorClosure: 0, footprintComplexity: 0, wallTopology: 0, scaleConfidence: 0, semanticCoverage: 0 },
      issues: [],
    },
    metadata: {
      createdAt: new Date().toISOString(),
      sourcePage: input.sourcePage,
      sourceSheetNumber: input.sourceSheetNumber,
      sourceSheetTitle: input.sourceSheetTitle,
      algorithms: {},
    },
  };
}
