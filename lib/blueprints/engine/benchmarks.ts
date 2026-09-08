import type { BosBuildingGraph } from "./building-graph";
import { footprintComplexity, topologyMetrics } from "./geometry";

export type BosBenchmarkExpectation = {
  id: string;
  sourceLabel: string;
  targetPage: number;
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
  id: "8100-mitchell-dewitt-first-floor",
  sourceLabel: "8100 Mitchell Dewitt existing JT.pdf",
  targetPage: 2,
  targetTitle: "EXISTING FIRST FLOOR PLAN",
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

export function runBuildingGraphBenchmark(graph: BosBuildingGraph, expectation: BosBenchmarkExpectation): BosBenchmarkResult {
  const exterior = graph.walls.filter((wall) => wall.type === "exterior");
  const footprintWalls = exterior.length ? exterior : graph.walls;
  const complexity = footprintComplexity(footprintWalls.map((wall) => wall.centerline));
  const topology = topologyMetrics(graph.walls.map((wall) => wall.centerline));
  const semanticNames = graph.rooms.map((room) => room.name?.toLowerCase() || "").join(" ");
  const garage = /garage/.test(semanticNames) || graph.slabs.some((slab) => slab.provenance.algorithm.toLowerCase().includes("garage"));
  const deckPorch = graph.decksPorches.length > 0;
  const stair = graph.stairs.length > 0;

  const checks = {
    targetPage: graph.metadata.sourcePage === expectation.targetPage,
    title: !graph.metadata.sourceSheetTitle || graph.metadata.sourceSheetTitle.toLowerCase().includes("first floor"),
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
