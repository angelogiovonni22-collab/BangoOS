import type { BosBuildingGraph } from "./building-graph";
import { footprintComplexity, topologyMetrics } from "./geometry";

export type BosBenchmarkExpectation = {
  id: string;
  sourceLabel: string;
  targetPage?: number;
  targetSheetNumber?: string;
  targetTitle: string;
  printedScale?: string;
  minWalls: number;
  minExteriorWalls: number;
  minFootprintComplexity: number;
  requireGarage: boolean;
  requireDeckPorch: boolean;
  requireStair: boolean;
  minTopologyClosure: number;
};

export const MITCHELL_DEWITT_FIRST_FLOOR: BosBenchmarkExpectation = {
  id: "8100-mitchell-dewitt-a4-first-floor",
  sourceLabel: "8100 Mitchell Dewitt Rd Proposed rv. 2.pdf",
  targetSheetNumber: "A4",
  targetTitle: "FIRST FLOOR PLAN",
  printedScale: `1/4\" = 1'-0\"`,
  minWalls: 12,
  minExteriorWalls: 8,
  minFootprintComplexity: 0.22,
  requireGarage: true,
  requireDeckPorch: true,
  requireStair: true,
  minTopologyClosure: 0.58,
};

export type BosBenchmarkResult = {
  passed: boolean;
  checks: Record<string, boolean>;
  metrics: Record<string, number>;
};

function normalize(value: string | undefined) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function runBuildingGraphBenchmark(graph: BosBuildingGraph, expectation: BosBenchmarkExpectation): BosBenchmarkResult {
  const exterior = graph.walls.filter((wall) => wall.type === "exterior");
  const footprintWalls = exterior.length ? exterior : graph.walls;
  const complexity = footprintComplexity(footprintWalls.map((wall) => wall.centerline));
  const topology = topologyMetrics(graph.walls.map((wall) => wall.centerline));
  const semanticNames = graph.rooms.map((room) => room.name?.toLowerCase() || "").join(" ");
  const garage = /garage/.test(semanticNames) || graph.slabs.some((slab) => slab.provenance.algorithm.toLowerCase().includes("garage"));
  const deckPorch = graph.decksPorches.length > 0;
  const stair = graph.stairs.length > 0;
  const actualSheet = normalize(graph.metadata.sourceSheetNumber);
  const expectedSheet = normalize(expectation.targetSheetNumber);
  const actualTitle = normalize(graph.metadata.sourceSheetTitle);
  const expectedTitle = normalize(expectation.targetTitle);

  const checks = {
    targetPage: expectation.targetPage === undefined || graph.metadata.sourcePage === expectation.targetPage,
    sheetNumber: !expectedSheet || actualSheet === expectedSheet,
    title: !expectedTitle || actualTitle.includes(expectedTitle),
    totalWalls: graph.walls.length >= expectation.minWalls,
    exteriorWalls: exterior.length === 0 || exterior.length >= expectation.minExteriorWalls,
    footprintNotRectangle: !(graph.walls.length === 4 && complexity < 0.12) && complexity >= expectation.minFootprintComplexity,
    garage: !expectation.requireGarage || garage,
    deckPorch: !expectation.requireDeckPorch || deckPorch,
    stair: !expectation.requireStair || stair,
    topology: topology.closure >= expectation.minTopologyClosure,
    scale: graph.scale.confidence >= 0.55 && graph.scale.drawingUnitsPerMeter !== null,
    validation: graph.validation.status !== "failed",
  };

  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    metrics: {
      walls: graph.walls.length,
      exteriorWalls: exterior.length,
      footprintComplexity: complexity,
      topologyClosure: topology.closure,
      scaleConfidence: graph.scale.confidence,
      validationScore: graph.validation.score,
    },
  };
}
