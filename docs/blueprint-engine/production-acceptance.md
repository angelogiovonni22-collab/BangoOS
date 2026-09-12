# B.O.S. Blueprint Production Acceptance Standard

B.O.S. must not call a Blueprint-to-3D reconstruction production-ready merely because it clears the older minimum benchmark. Final release acceptance requires both structural metrics and a human visual check against the actual source plan.

## Mitchell Dewitt automated gate

The executable gate is `MITCHELL_DEWITT_PRODUCTION_STANDARD` in `lib/blueprints/engine/acceptance.ts`.

The authoritative Mitchell source is sheet `A4 / First Floor Plan` in `8100 Mitchell Dewitt Rd Proposed rv. 2.pdf`. Its current physical PDF page is page 1, but acceptance is bound to sheet identity and title rather than page position.

Required automated thresholds:

- selected source is positively identified as `A4 / First Floor Plan`;
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

Compare the final generated model directly against A4. The reviewer must verify that the following are recognizable and correctly related: attached 2-car garage, rear/outside deck, stair core, irregular main-house footprint, entry projection, exterior offsets/jogs, major interior partitions, windows/doors, and overall first-floor proportions.

Use at least these views during review:

1. top-down orthographic reconstruction beside A4;
2. exterior/isometric 3D view showing all footprint offsets;
3. interior/section-style view sufficient to confirm major partitions and stair position.

Any obvious missing wing, garage/deck displacement, collapsed footprint, major wall relocation, incorrect sheet selection, or clearly incorrect scale is a failure even when numeric metrics pass.

## Measurement acceptance

Customer-facing dimensions must come from the verified Building Graph and be displayed in feet and inches. The visual image model is not allowed to invent construction dimensions. If scale verification fails, dimensions must be withheld rather than guessed.

## Regression rule

Future model, detector, or fusion changes must not lower any accepted Mitchell A4 metric below this standard. Manual corrections remain authoritative and must survive regeneration. Learned inference must remain fail-closed: if inference is unavailable, malformed, inconsistent with the selected source identity, or fails consensus, B.O.S. keeps the deterministic graph instead of silently promoting uncertain geometry.

The former page-2/A1 Mitchell benchmark is retired as Production truth and may not satisfy this gate.

## User acceptance

The final Blueprint accuracy phase is complete only after the automated Production gate passes and the real A4 source-vs-3D visual walkthrough is approved in B.O.S. Production. Until both happen, the feature remains under validation regardless of how good a single render looks.
