# Blueprint Engine Benchmark Criteria

Benchmarks are release gates, not demos. A benchmark passes only when the produced canonical Building Graph satisfies all required geometry, semantic, scale, and validation checks for that source.

## Permanent benchmark: 8100 Mitchell Dewitt — Existing First Floor

Source label: `8100 Mitchell Dewitt existing JT.pdf`

Registered target:

- page: `2`
- title: `EXISTING FIRST FLOOR PLAN`
- printed scale: `1/4" = 1'-0"`

Required checks:

- selected source page is page 2;
- first-floor sheet title is correctly targeted;
- at least 12 reconstructed wall segments;
- when exterior walls are explicitly classified, at least 8 exterior wall segments;
- footprint complexity at least `0.22`;
- no four-wall rectangle simplification;
- garage semantic present;
- deck/porch semantic present;
- stair semantic present;
- wall topology closure at least `0.58`;
- verified scale confidence at least `0.55` with a non-null drawing-units-per-meter value;
- validation status is not `failed`;
- final visual output must resemble the source footprint closely enough that garage, offsets/jogs, deck/porch, and stair-core relationships are recognizable.

The executable contract is `MITCHELL_DEWITT_FIRST_FLOOR` in `lib/blueprints/engine/benchmarks.ts`.

## Global benchmark rules

Every release-candidate benchmark must validate:

1. Correct sheet/page targeting.
2. Verified or explicitly corrected scale.
3. Minimum geometry coverage appropriate to the source.
4. Exterior footprint shape and complexity.
5. Wall topology and dangling endpoints.
6. Required architectural semantics where visible in the source.
7. Validation status and score.
8. No silent substitution of a simpler bounding shape.
9. Stable regeneration from the same source and algorithm version.
10. Correction replay where the benchmark includes human corrections.

## Mandatory failure corpus

The benchmark suite must eventually include at least one case for each of the following:

- multi-page PDF where the target drawing is not page 1;
- low-resolution scanned floor plan;
- vector PDF with dense dimension/annotation linework;
- irregular residential footprint;
- attached garage;
- deck/porch projection;
- stair/core alignment;
- missing printed scale;
- conflicting dimensions;
- sparse plan that should return `needs_input`;
- bad first-pass four-wall rectangle that must be rejected;
- multi-floor alignment case;
- corrected graph regeneration case.

## Release thresholds

A benchmark cannot be marked passed because a GLB opens successfully. The corresponding Building Graph must pass the benchmark-specific checks. Any benchmark regression blocks merge unless the failure is explicitly accepted by updating this control document and the executable benchmark in the same PR with a documented reason.

## Visual verification rule

For production-hardening phases, automated graph metrics must be paired with an authenticated visual verification of the actual B.O.S. Blueprint viewer. The result must show the correct source sheet and a 3D footprint consistent with the benchmark criteria.