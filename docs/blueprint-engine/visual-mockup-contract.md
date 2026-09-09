# AI Visual Mockup Contract

The AI Visual Mockup is a presentation artifact that complements the canonical B.O.S. Building Graph, GLB, IFC, corrections, validation and downstream intelligence. It never replaces or upgrades those technical records.

## Source and generation boundary

- A mockup is bound to one tenant, project, registered Blueprint revision and deterministic selected source page.
- The server securely renders only that selected page and includes the persisted Building Graph and correction-derived context.
- The locked prompt template is versioned as `bos-blueprint-visual-v2-geometry-lock`.
- Layout-faithful generation fails closed unless the Building Graph is `reconstructed`, scores at least 78%, has verified scale, at least 70% exterior closure and wall topology, at least eight walls, and no structural errors.
- B.O.S. renders a deterministic geometry-lock PNG from the approved graph and supplies it beside the authoritative source page to the image editor at high input fidelity. The image model may style the structure but must not define it.
- A technical model in `needs_review`, `needs_input` or `failed` must be corrected before another layout-faithful visual can be generated; technical takeoff, costing and construction gates remain unchanged.

## Persistence and security

Every generation and regeneration creates a new `blueprint_visual_mockups` row and a new private object in the existing `blueprints` bucket. Earlier attempts are not overwritten. RLS, composite revision identity, immutable tenant/source identity and storage-path authorization protect the records. The browser receives only a short-lived signed URL; provider credentials and raw provider responses remain server-side.

States are `queued`, `processing`, `ready`, `needs_review` and `failed`. A successful visual state requires a private image path and MIME type. A failed state cannot retain a false-success image path.

## Presentation contract

The output targets a complete roofless elevated isometric view with blueprint orientation preserved, coherent connected walls, supported garage/deck/stair/opening semantics, restrained optional furnishings and a neutral B.O.S. presentation background. The prompt forbids invented floors or wings, floating walls, labels, dimensions, people and watermarks.

Every record and UI surface carries this exact warning:

> Conceptual AI visualization — verify against the source plans before construction use.

The result is not dimension-certified, pixel-perfect or construction-ready. Visual comparison and conceptual review remain required, even after the geometry gate passes.
