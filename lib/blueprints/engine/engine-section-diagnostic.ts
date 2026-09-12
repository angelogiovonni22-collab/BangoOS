import assert from "node:assert/strict";
import { createEmptyBosBuildingGraph, type BosWall } from "./building-graph";
import { MITCHELL_DEWITT_FIRST_FLOOR, runBuildingGraphBenchmark } from "./benchmarks";
import { parseArchitecturalLength, parsePrintedScale } from "./dimensions";
import { associateDimensionsToWalls } from "./dimension-solver";
import { footprintComplexity, mergeCollinearSegments, topologyMetrics, type BosRawSegment } from "./geometry";
import { buildBosBuildingGraphIfc } from "./graph-to-ifc";
import { detectWallGapOpenings } from "./openings";
import { selectTargetPage, type BosParsedPage } from "./plan-parser";
import { latestPersistedManualScale, replayPersistedBosGraphCorrections, type PersistedBosGraphCorrectionRow } from "./persisted-corrections";
import { applyBosValidation } from "./validation";

const mode = process.argv[2] || "base";
const scale = parsePrintedScale(`1/4\" = 1'-0\"`);
assert(scale);
const graph = createEmptyBosBuildingGraph({ buildingId: "benchmark-house", sourcePage: 1, levelName: "First Floor", sourceSheetNumber: "A4", sourceSheetTitle: "First Floor Plan" });
graph.scale = scale;
const perimeter = [[0,0,12,0],[12,0,12,4],[12,4,15,4],[15,4,15,11],[15,11,11,11],[11,11,11,14],[11,14,5,14],[5,14,5,11],[5,11,0,11],[0,11,0,7],[-5,7,-5,0],[-5,0,0,0]] as const;
graph.walls = perimeter.map(([x1,y1,x2,y2], index): BosWall => ({ id:`wall-${index+1}`, levelId:"level-1", type:"exterior", centerline:{start:{x:x1,y:y1},end:{x:x2,y:y2}}, thickness:0.1524, height:2.4384, confidence:0.92, sourcePage:1, evidence:[], provenance:{createdBy:"deterministic",algorithm:"benchmark-fixture",algorithmVersion:"1",evidenceIds:[]} }));
graph.rooms.push({ id:"room-garage",levelId:"level-1",type:"room",name:"2-Car Garage",polygon:{points:[{x:-5,y:0},{x:0,y:0},{x:0,y:7},{x:-5,y:7}]},confidence:0.9,sourcePage:1,evidence:[],provenance:{createdBy:"deterministic",algorithm:"benchmark-fixture",algorithmVersion:"1",evidenceIds:[]} });
graph.decksPorches.push({ id:"deck-1",levelId:"level-1",type:"deck",polygon:{points:[{x:5,y:14},{x:11,y:14},{x:11,y:17},{x:5,y:17}]},thickness:0.15,elevation:0,confidence:0.9,sourcePage:1,evidence:[],provenance:{createdBy:"deterministic",algorithm:"benchmark-fixture",algorithmVersion:"1",evidenceIds:[]} });
graph.stairs.push({ id:"stair-1",levelId:"level-1",type:"stair",polygon:{points:[{x:6,y:5},{x:8,y:5},{x:8,y:8},{x:6,y:8}]},direction:"up",confidence:0.85,sourcePage:1,evidence:[],provenance:{createdBy:"deterministic",algorithm:"benchmark-fixture",algorithmVersion:"1",evidenceIds:[]} });
const validated = applyBosValidation(graph);

if (mode === "base") {
  assert(scale.drawingUnitsPerMeter && scale.drawingUnitsPerMeter > 0);
  assert.equal(Math.round((parseArchitecturalLength(`10'-6\"`) || 0) * 1000), 3200);
  const pages: BosParsedPage[] = [
    {pageNumber:1,width:1000,height:700,text:[{text:"EXISTING BASEMENT FLOOR PLAN",page:1}],vectorSegments:[],rasterRequired:false},
    {pageNumber:2,width:1000,height:700,text:[{text:`EXISTING FIRST FLOOR PLAN 1/4\" = 1'-0\" OUTSIDE DECK 2-CAR GARAGE`,page:2}],vectorSegments:[],rasterRequired:false},
    {pageNumber:3,width:1000,height:700,text:[{text:"EXISTING SECOND FLOOR PLAN",page:3}],vectorSegments:[],rasterRequired:false},
  ];
  const selected = selectTargetPage(pages,{title:"EXISTING FIRST FLOOR PLAN",discipline:"Architectural"});
  assert.equal(selected.page.pageNumber,2); assert(selected.score > 0.5);
  const raw: BosRawSegment[] = [{sourcePage:2,start:{x:0,y:0},end:{x:4,y:0}},{sourcePage:2,start:{x:4,y:0},end:{x:8,y:0}},{sourcePage:2,start:{x:8,y:0},end:{x:8,y:4}}];
  const merged=mergeCollinearSegments(raw); assert.equal(merged.length,2); assert.equal(topologyMetrics(merged).nodes,3);
}
if (mode === "benchmark") {
  assert(footprintComplexity(graph.walls.map(w=>w.centerline)) >= MITCHELL_DEWITT_FIRST_FLOOR.minFootprintComplexity);
  assert(runBuildingGraphBenchmark(validated,MITCHELL_DEWITT_FIRST_FLOOR).passed);
}
if (mode === "openings") {
  const walls: BosWall[]=[{...graph.walls[0],id:"opening-a",centerline:{start:{x:0,y:0},end:{x:2,y:0}}},{...graph.walls[0],id:"opening-b",centerline:{start:{x:2.9,y:0},end:{x:5,y:0}}}];
  const result=detectWallGapOpenings(walls); assert.equal(result.doors.length,1); assert.equal(result.doors[0].wallId,"opening-b");
}
if (mode === "dimension") {
  graph.dimensions.push({id:"dimension-wall-1",levelId:"level-1",page:1,start:{x:0,y:-0.4},end:{x:12,y:-0.4},value:12,unit:"m",confidence:0.95,evidence:[]});
  assert(associateDimensionsToWalls(graph).some(item=>item.wallId==="wall-1"));
}
if (mode === "ifc") {
  const out=buildBosBuildingGraphIfc(validated); assert(out.startsWith("ISO-10303-21;")); assert(out.includes("IFCWALLSTANDARDCASE")); assert(out.includes("FILE_SCHEMA(('IFC4'))"));
}
if (mode === "corrections") {
  const rows: PersistedBosGraphCorrectionRow[]=[
    {id:"00000000-0000-0000-0000-000000000001",correction_type:"set_scale",payload:{type:"set_scale",drawingUnitsPerMeter:144,createdAt:"2026-09-08T09:00:00.000Z"},created_by:"user-1",created_at:"2026-09-08T09:00:00.000Z"},
    {id:"00000000-0000-0000-0000-000000000002",correction_type:"classify_wall",payload:{type:"classify_wall",wallId:"wall-1",wallType:"interior",createdAt:"2026-09-08T09:01:00.000Z"},created_by:"user-1",created_at:"2026-09-08T09:01:00.000Z"},
  ];
  assert.equal(latestPersistedManualScale(rows),144); const replay=replayPersistedBosGraphCorrections(validated,rows); assert.equal(replay.graph.scale.source,"manual"); assert.equal(replay.graph.walls.find(w=>w.id==="wall-1")?.type,"interior"); assert.equal(replay.graph.walls.find(w=>w.id==="wall-1")?.provenance.createdBy,"manual"); assert.equal(replay.conflicts.length,0);
  const conflict=replayPersistedBosGraphCorrections(validated,[{id:"00000000-0000-0000-0000-000000000003",correction_type:"move_wall",payload:{type:"move_wall",wallId:"missing-wall",start:{x:0,y:0},end:{x:1,y:0},createdAt:"2026-09-08T09:02:00.000Z"},created_by:"user-1",created_at:"2026-09-08T09:02:00.000Z"}]);
  assert.equal(conflict.conflicts.length,1); assert.equal(conflict.graph.validation.status,"needs_review"); assert(conflict.graph.validation.issues.some(issue=>issue.code==="CORRECTION_CONFLICT"));
}
if (mode === "rectangle") {
  const rectangle=createEmptyBosBuildingGraph({buildingId:"bad",sourcePage:1,sourceSheetNumber:"A4",sourceSheetTitle:"First Floor Plan"}); rectangle.scale=scale;
  rectangle.walls=[[0,0,10,0],[10,0,10,10],[10,10,0,10],[0,10,0,0]].map(([x1,y1,x2,y2],index):BosWall=>({id:`rectangle-${index}`,levelId:"level-1",type:"exterior",centerline:{start:{x:x1,y:y1},end:{x:x2,y:y2}},thickness:0.15,height:2.44,confidence:0.99,sourcePage:1,evidence:[],provenance:{createdBy:"deterministic",algorithm:"bad-fixture",algorithmVersion:"1",evidenceIds:[]}}));
  const result=runBuildingGraphBenchmark(applyBosValidation(rectangle),MITCHELL_DEWITT_FIRST_FLOOR); assert.equal(result.passed,false); assert.equal(result.checks.footprintNotRectangle,false);
}
console.log(`engine diagnostic ${mode}: PASS`);
