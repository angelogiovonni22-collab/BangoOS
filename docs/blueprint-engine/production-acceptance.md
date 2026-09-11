# B.O.S. Blueprint Production Acceptance Standard

B.O.S. must not call a Blueprint-to-3D reconstruction production-ready merely because it clears the older minimum benchmark. Final release acceptance requires both structural metrics and a human visual check against the actual source plan.

## Mitchell Dewitt automated gate

The executable gate is `MITCHELL_DEWITT_PRODUCTION_STANDARD` in `lib/blueprints/engine/acceptance.ts`.

Required automated thresholds:

- selected source page is the verified first-floor sheet;
- legacy Mitchell benchmark passes, including garage, deck/porch, stair core, scale, and irregular-footprint checks;
- graph confidence >= 0.82;
- validation score >= 0.82;
- full wall-topology closure >= 0.80;
- exterior closure >= 0.75;
- scale confidence >= 0.90;
- semantic coverage >= 0.70;
- at least 6 reconstructed rooms;
- at least 6 openings;
- validation status is `reconstructed`, not `needs_review`;
- zero validation issues with severity `error`.

These values are intentionally higher than the historical deterministic baseline. A learned model is not accepted merely for producing more geometry; the resulting graph must improve validation and retain verified source semantics.

## Human acceptance test

After the real GPU benchmark is available, compare the final generated model directly against the source plan. The reviewer must verify that the following are recognizable and correctly related: attached 2-car garage, rear/outside deck, stair core, irregular main-house footprint, entry projection, exterior offsets/jogs, major interior partitions, windows/doors, and overall first-floor proportions.

Use at least these views during review:

1. top-down orthographic reconstruction beside the source plan;
2. exterior/isometric 3D view showing all footprint offsets;
3. interior/section-style view sufficient to confirm major partitions and stair position.

Any obvious missing wing, garage/deck displacement, collapsed footprint, major wall relocation, incorrect floor selection, or clearly incorrect scale is a failure even when numeric metrics pass.

## Regression rule

Future model, detector, or fusion changes must not lower any accepted Mitchell metric below this standard. Manual corrections remain authoritative and must survive regeneration. Learned inference must remain fail-closed: if inference is unavailable, malformed, inconsistent with the selected source page, or fails consensus, B.O.S. keeps the deterministic graph instead of silently promoting uncertain geometry.

## User acceptance

The final Blueprint accuracy phase is complete only after the automated production gate passes and the real source-vs-3D visual walkthrough is approved in B.O.S. Production. Until both happen, the feature remains under validation regardless of how good a single render looks.
