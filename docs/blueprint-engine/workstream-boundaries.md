# Blueprint Engine Workstream Boundaries

These boundaries prevent duplicate implementations and keep the native engine composable.

## 1. Source and sheet targeting

Owns:
- source revision metadata;
- multi-page page discovery;
- registered sheet number/title/discipline matching;
- target confidence and alternate-page diagnostics.

Does not own:
- wall detection;
- scale conversion;
- semantic room classification;
- 3D output.

Primary code:
- `lib/blueprints/engine/plan-parser.ts`
- `lib/blueprints/engine/pdf-vector-parser.ts`

## 2. Scale and dimensions

Owns:
- printed scale parsing;
- printed dimension parsing;
- drawing-units-per-meter;
- dimension reconciliation;
- manual scale corrections.

Does not own:
- wall candidate extraction;
- room semantics;
- validation status policy.

Primary code:
- `lib/blueprints/engine/dimensions.ts`
- `lib/blueprints/engine/dimension-solver.ts`

## 3. Geometry reconstruction

Owns:
- vector/raster line candidates;
- snapping;
- collinear merging;
- paired-line wall detection;
- centerline conversion;
- wall thickness/height defaults;
- topology primitives.

Does not own:
- page selection;
- user correction persistence;
- export/UI.

Primary code:
- `lib/blueprints/engine/geometry.ts`
- `lib/blueprints/engine/wall-detector.ts`
- `lib/blueprints/engine/raster.ts`

## 4. Architectural semantics

Owns:
- exterior/interior classification;
- openings/doors/windows;
- room names/polygons;
- garage/deck/porch/stair semantics;
- future roof/slab/structural semantic promotion.

Does not own:
- validation release decision;
- GLB/IFC serialization.

Primary code:
- `lib/blueprints/engine/architecture.ts`
- `lib/blueprints/engine/openings.ts`

## 5. Canonical graph and orchestration

Owns:
- graph schema/invariants;
- pipeline ordering;
- reconstruction versions;
- algorithm-version metadata;
- composing targeting, geometry, scale, semantics, and validation.

Primary code:
- `lib/blueprints/engine/building-graph.ts`
- `lib/blueprints/engine/reconstruct.ts`
- `lib/blueprints/engine/multi-floor.ts`

## 6. Validation and benchmarks

Owns:
- graph-level quality metrics;
- failure codes;
- release states;
- source-specific benchmark gates;
- permanent failure regressions.

Does not own:
- silently repairing geometry merely to satisfy thresholds.

Primary code:
- `lib/blueprints/engine/validation.ts`
- `lib/blueprints/engine/benchmarks.ts`
- `lib/blueprints/engine/engine.contract.test.ts`

## 7. Corrections and provenance

Owns:
- correction event contract;
- correction replay;
- manual provenance;
- persistence/API for correction events;
- compatibility/conflict detection during regeneration.

Does not own:
- initial reconstruction.

Primary code:
- `lib/blueprints/engine/corrections.ts`
- `app/api/blueprints/[versionId]/generated-3d/corrections/route.ts`
- `blueprint_model_corrections` migration/table.

## 8. Persistence and tenancy

Owns:
- generated-model graph/validation/version columns;
- engine status lifecycle;
- RLS;
- storage authorization;
- correction event tenancy.

Does not own:
- geometry decisions.

Primary code:
- `supabase/migrations/*blueprint*`

## 9. 3D and export

Owns:
- canonical graph to GLB;
- canonical graph to IFC;
- object ID/metadata propagation;
- export endpoints.

Does not own:
- generating alternate hidden geometry outside `BosBuildingGraph`.

Primary code:
- `lib/blueprints/engine/graph-to-glb.ts`
- `lib/blueprints/engine/graph-to-ifc.ts`
- `app/api/blueprints/[versionId]/generated-3d/export/route.ts`

## 10. Blueprint UI/review workspace

Owns:
- generation status;
- confidence/validation presentation;
- 3D viewer integration;
- correction controls;
- export controls;
- visual comparison/review workflows.

Does not own:
- source-of-truth geometry logic in client code.

Primary code:
- `components/plans/*`

## 11. AI-assist boundary

AI may:
- classify ambiguous symbols/text;
- suggest room/opening semantics;
- assist raster interpretation when deterministic extraction is insufficient;
- explain uncertainty.

AI may not:
- override a verified printed scale without evidence;
- convert a failed graph into `reconstructed` merely by producing plausible geometry;
- bypass benchmark failures;
- become a second authoritative graph outside `BosBuildingGraph`.

## 12. Orion/downstream boundary

Orion and downstream modules may query validated graph data, but they must not mutate canonical geometry directly. Geometry changes flow through the correction API/workspace so provenance and validation remain intact.