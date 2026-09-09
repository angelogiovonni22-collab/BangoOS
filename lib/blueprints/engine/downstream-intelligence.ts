import type { BosBuildingGraph, BosGraphObjectBase, BosPoint2 } from "./building-graph";

export type BosDerivedQuantity = {
  key: string;
  label: string;
  quantity: number;
  unit: "m" | "m2" | "count";
  sourceObjectIds: string[];
  eligibleCostCategories: Array<"labor" | "materials" | "subcontractors" | "general_conditions">;
};

export type BosGraphQuery = {
  levelId?: string;
  objectId?: string;
  roomName?: string;
  objectType?: "wall" | "opening" | "room" | "stair" | "deck_porch";
};

function length(start: BosPoint2, end: BosPoint2) {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

function polygonArea(points: BosPoint2[]) {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
}

function rounded(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function requireValidatedBuildingGraph(graph: BosBuildingGraph) {
  if (graph.validation.status !== "reconstructed" || graph.validation.score < 0.7) {
    throw new Error("B.O.S. downstream quantities require a reconstructed Building Graph with at least 70% validation confidence.");
  }
  if (!graph.walls.length || !graph.levels.length) throw new Error("B.O.S. downstream quantities require wall and level geometry.");
  return graph;
}

export function summarizeBuildingGraphForOrion(graph: BosBuildingGraph) {
  const exteriorWalls = graph.walls.filter((wall) => wall.type === "exterior");
  const interiorWalls = graph.walls.filter((wall) => wall.type === "interior");
  return {
    buildingId: graph.building.id,
    sourceVersionId: graph.building.sourceVersionId || null,
    reconstructionVersion: graph.reconstructionVersion,
    validationStatus: graph.validation.status,
    validationScore: graph.validation.score,
    confidence: graph.confidence,
    levels: graph.levels.map((level) => ({ id: level.id, name: level.name, index: level.index, elevation: level.elevation, sourcePage: level.sourcePage, sourceSheetNumber: level.sourceSheetNumber || null, sourceSheetTitle: level.sourceSheetTitle || null })),
    counts: {
      walls: graph.walls.length,
      exteriorWalls: exteriorWalls.length,
      interiorWalls: interiorWalls.length,
      doors: graph.doors.length,
      windows: graph.windows.length,
      rooms: graph.rooms.length,
      stairs: graph.stairs.length,
      decksPorches: graph.decksPorches.length,
    },
    exteriorWallLengthMeters: rounded(exteriorWalls.reduce((sum, wall) => sum + length(wall.centerline.start, wall.centerline.end), 0)),
    interiorWallLengthMeters: rounded(interiorWalls.reduce((sum, wall) => sum + length(wall.centerline.start, wall.centerline.end), 0)),
    roomNames: graph.rooms.map((room) => room.name).filter((name): name is string => Boolean(name)),
    validationIssues: graph.validation.issues.map((issue) => ({ code: issue.code, severity: issue.severity, message: issue.message, objectIds: issue.objectIds || [] })),
  };
}

export function queryBuildingGraph(graph: BosBuildingGraph, query: BosGraphQuery) {
  const levelMatch = (item: { levelId: string }) => !query.levelId || item.levelId === query.levelId;
  const objectMatch = (item: { id: string }) => !query.objectId || item.id === query.objectId;
  const response: Array<{ type: BosGraphQuery["objectType"]; object: unknown }> = [];
  if (!query.objectType || query.objectType === "wall") {
    response.push(...graph.walls.filter((item) => levelMatch(item) && objectMatch(item)).map((object) => ({ type: "wall" as const, object })));
  }
  if (!query.objectType || query.objectType === "opening") {
    response.push(...graph.openings.filter((item) => levelMatch(item) && objectMatch(item)).map((object) => ({ type: "opening" as const, object })));
  }
  if (!query.objectType || query.objectType === "room") {
    response.push(...graph.rooms.filter((item) => levelMatch(item) && objectMatch(item) && (!query.roomName || (item.name || "").toLowerCase().includes(query.roomName.toLowerCase()))).map((object) => ({ type: "room" as const, object })));
  }
  if (!query.objectType || query.objectType === "stair") {
    response.push(...graph.stairs.filter((item) => levelMatch(item) && objectMatch(item)).map((object) => ({ type: "stair" as const, object })));
  }
  if (!query.objectType || query.objectType === "deck_porch") {
    response.push(...graph.decksPorches.filter((item) => levelMatch(item) && objectMatch(item)).map((object) => ({ type: "deck_porch" as const, object })));
  }
  return response;
}

export function deriveValidatedBlueprintQuantities(graph: BosBuildingGraph): BosDerivedQuantity[] {
  requireValidatedBuildingGraph(graph);
  const exterior = graph.walls.filter((wall) => wall.type === "exterior");
  const interior = graph.walls.filter((wall) => wall.type === "interior");
  const wallArea = (walls: typeof graph.walls) => walls.reduce((sum, wall) => sum + length(wall.centerline.start, wall.centerline.end) * wall.height, 0);
  const roomArea = graph.rooms.reduce((sum, room) => sum + (room.area && room.area > 0 ? room.area : polygonArea(room.polygon.points)), 0);
  const deckArea = graph.decksPorches.reduce((sum, item) => sum + polygonArea(item.polygon.points), 0);

  const values: BosDerivedQuantity[] = [
    { key: "exterior-wall-length", label: "Exterior wall centerline length", quantity: rounded(exterior.reduce((sum, wall) => sum + length(wall.centerline.start, wall.centerline.end), 0)), unit: "m", sourceObjectIds: exterior.map((wall) => wall.id), eligibleCostCategories: ["labor", "materials", "subcontractors"] },
    { key: "interior-wall-length", label: "Interior wall centerline length", quantity: rounded(interior.reduce((sum, wall) => sum + length(wall.centerline.start, wall.centerline.end), 0)), unit: "m", sourceObjectIds: interior.map((wall) => wall.id), eligibleCostCategories: ["labor", "materials", "subcontractors"] },
    { key: "gross-wall-face-area", label: "Gross wall face area", quantity: rounded(wallArea(graph.walls)), unit: "m2", sourceObjectIds: graph.walls.map((wall) => wall.id), eligibleCostCategories: ["labor", "materials", "subcontractors"] },
    { key: "room-floor-area", label: "Reconstructed room floor area", quantity: rounded(roomArea), unit: "m2", sourceObjectIds: graph.rooms.map((room) => room.id), eligibleCostCategories: ["labor", "materials", "subcontractors"] },
    { key: "deck-porch-area", label: "Deck / porch plan area", quantity: rounded(deckArea), unit: "m2", sourceObjectIds: graph.decksPorches.map((item) => item.id), eligibleCostCategories: ["labor", "materials", "subcontractors"] },
    { key: "door-count", label: "Detected doors", quantity: graph.doors.length, unit: "count", sourceObjectIds: graph.doors.map((item) => item.id), eligibleCostCategories: ["labor", "materials", "subcontractors"] },
    { key: "window-count", label: "Detected windows", quantity: graph.windows.length, unit: "count", sourceObjectIds: graph.windows.map((item) => item.id), eligibleCostCategories: ["labor", "materials", "subcontractors"] },
  ];
  return values.filter((item) => item.quantity > 0);
}

export function buildBlueprintCostingIntegration(graph: BosBuildingGraph) {
  const quantities = deriveValidatedBlueprintQuantities(graph);
  return {
    source: "bos-building-graph" as const,
    sourceVersionId: graph.building.sourceVersionId || null,
    reconstructionVersion: graph.reconstructionVersion,
    validationScore: graph.validation.score,
    requiresCostCodeSelection: true,
    pricingStatus: "unpriced" as const,
    quantities,
  };
}

function objectAnchor(item: BosGraphObjectBase & { polygon?: { points: BosPoint2[] }; centerline?: { start: BosPoint2; end: BosPoint2 } }) {
  if (item.centerline) return { x: (item.centerline.start.x + item.centerline.end.x) / 2, y: (item.centerline.start.y + item.centerline.end.y) / 2 };
  if (item.polygon?.points.length) return {
    x: item.polygon.points.reduce((sum, point) => sum + point.x, 0) / item.polygon.points.length,
    y: item.polygon.points.reduce((sum, point) => sum + point.y, 0) / item.polygon.points.length,
  };
  return null;
}

export function buildRealityEngineAlignmentContract(graph: BosBuildingGraph) {
  requireValidatedBuildingGraph(graph);
  const anchors = [
    ...graph.stairs.map((item) => ({ id: item.id, type: "stair" as const, levelId: item.levelId, point: objectAnchor(item), confidence: item.confidence })),
    ...graph.rooms.filter((room) => /garage|entry|lobby|hall|stair/i.test(room.name || "")).map((item) => ({ id: item.id, type: "room" as const, levelId: item.levelId, point: objectAnchor(item), confidence: item.confidence })),
  ].filter((item): item is typeof item & { point: BosPoint2 } => Boolean(item.point));
  return {
    version: 1 as const,
    coordinateSystem: "bos-plan-meters" as const,
    buildingId: graph.building.id,
    blueprintVersionId: graph.building.sourceVersionId || null,
    reconstructionVersion: graph.reconstructionVersion,
    validationScore: graph.validation.score,
    axes: { planX: "x", planY: "y", vertical: "level.elevation" },
    levels: graph.levels.map((level) => ({ id: level.id, name: level.name, elevationMeters: level.elevation, sourcePage: level.sourcePage, sourceSheetNumber: level.sourceSheetNumber || null })),
    anchors,
  };
}

export function validateBosIfcCoordinationExport(ifc: string, graph?: BosBuildingGraph) {
  const issues: string[] = [];
  if (!ifc.startsWith("ISO-10303-21;")) issues.push("IFC STEP header is missing.");
  if (!ifc.includes("FILE_SCHEMA(('IFC4'))")) issues.push("IFC4 schema declaration is missing.");
  if (!ifc.trimEnd().endsWith("END-ISO-10303-21;")) issues.push("IFC STEP footer is missing.");
  for (const entity of ["IFCPROJECT(", "IFCSITE(", "IFCBUILDING(", "IFCBUILDINGSTOREY(", "IFCRELAGGREGATES("]) if (!ifc.includes(entity)) issues.push(`${entity.slice(0, -1)} entity is missing.`);

  const entityIds = new Set([...ifc.matchAll(/^#(\d+)=/gm)].map((match) => Number(match[1])));
  for (const match of ifc.matchAll(/#(\d+)/g)) {
    const id = Number(match[1]);
    if (!entityIds.has(id)) issues.push(`IFC reference #${id} does not resolve to an entity.`);
  }
  if (graph) {
    const storeyCount = (ifc.match(/IFCBUILDINGSTOREY\(/g) || []).length;
    if (storeyCount !== graph.levels.length) issues.push(`IFC storey count ${storeyCount} does not match Building Graph level count ${graph.levels.length}.`);
    const wallCount = (ifc.match(/IFCWALLSTANDARDCASE\(/g) || []).length;
    const expectedWalls = graph.walls.filter((wall) => length(wall.centerline.start, wall.centerline.end) > 0.001).length;
    if (wallCount !== expectedWalls) issues.push(`IFC wall count ${wallCount} does not match exportable Building Graph wall count ${expectedWalls}.`);
  }
  return { valid: issues.length === 0, issues, entityCount: entityIds.size };
}
