# Canonical B.O.S. Building Graph Contract

The canonical implementation is `lib/blueprints/engine/building-graph.ts`. This document defines the invariants that code, persistence, UI, benchmarks, exports, and downstream intelligence must preserve.

## Schema identity

- Type: `BosBuildingGraph`.
- Current schema version: `1`.
- Canonical length unit: meters (`m`).
- Reconstruction version and algorithm versions are explicit and persisted.
- Graphs are tenant/project/source-revision scoped through `building.companyId`, `building.projectId`, and `building.sourceVersionId` when available.

## Required top-level domains

- `building`
- `levels`
- `walls`
- `openings`
- `doors`
- `windows`
- `rooms`
- `stairs`
- `slabs`
- `decksPorches`
- `dimensions`
- `scale`
- `sourceEvidence`
- `confidence`
- `validation`
- `metadata`

## Geometry rules

- 2D plan geometry uses `{x,y}` meters in a consistent sheet-local coordinate system.
- Level elevation uses meters.
- Wall centerlines are straight segments with explicit thickness and height.
- Openings reference a wall ID and use an offset along that wall.
- Room/stair/slab/deck/porch boundaries are polygons.
- The graph may contain incomplete semantic objects only if their confidence and validation state make the uncertainty explicit.

## Object evidence rules

Every reconstructed graph object must carry:

- stable `id`;
- `levelId`;
- `confidence` in `[0,1]`;
- `sourcePage`;
- zero or more `evidence` records;
- `provenance` describing who/what created the object and which evidence IDs support it;
- optional `correction` state when manually modified.

Evidence may be `pdf_vector`, `pdf_text`, `raster`, `ai`, `manual`, or `derived`. Evidence must never claim a source kind that did not actually contribute to the object.

## Provenance rules

`createdBy` is one of:

- `deterministic`
- `ai_assisted`
- `manual`

The algorithm name and version are mandatory. Regeneration must not erase prior user correction provenance. Manual corrections convert affected objects to manual provenance while retaining the underlying graph/evidence history through correction events.

## Confidence rules

- Confidence values are clamped to `[0,1]`.
- Object confidence and graph confidence are distinct.
- High object confidence does not override a failing graph-level validation gate.
- `reconstructed` status requires validation success, not merely a high average confidence.

## Scale rules

Scale source is one of:

- `printed`
- `dimension_solved`
- `manual`
- `unknown`

`drawingUnitsPerMeter` must be positive when present. Geometry may not be promoted as native reconstructed metric geometry while scale is unknown or below the configured validation threshold.

## Validation contract

The graph embeds `BosValidationReport` with:

- overall score;
- state: `reconstructed`, `needs_review`, `needs_input`, or `failed`;
- metrics for exterior closure, footprint complexity, wall topology, scale confidence, and semantic coverage;
- explicit issues with severity/code/message and optional object/evidence references.

A four-wall bounding rectangle produced from a visibly irregular floor plan is a hard benchmark failure, even if the rectangle is topologically closed.

## Correction contract

Corrections are modeled separately as append-only `BosGraphCorrection` events and are persisted in `blueprint_model_corrections`.

Supported correction classes currently include:

- move wall;
- add wall;
- remove wall;
- classify wall;
- update opening;
- update room;
- set scale.

Regeneration must replay compatible corrections in deterministic chronological order. A correction that cannot be replayed against a changed graph must be surfaced for review rather than silently discarded.

## Persistence contract

`blueprint_generated_models` stores the active reconstruction and associated metadata including:

- `building_graph`;
- `validation_report`;
- `engine_status`;
- `reconstruction_version`;
- `algorithm_versions`;
- `source_page`;
- `correction_history`.

Tenant RLS remains mandatory for generated models and correction events.

## Output contract

GLB and IFC output are generated from the canonical graph, not from a parallel geometry representation. Output metadata should preserve B.O.S. object IDs and source/validation information when the target format allows it.

## Compatibility rule

Legacy `geometry_json` may remain during migration, but new native functionality must treat `building_graph` as authoritative once present.