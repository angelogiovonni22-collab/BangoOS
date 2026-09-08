# B.O.S. Native Blueprint Engine — Control Center

This directory is the persistent repository-level source of truth for the B.O.S. Native Blueprint Engine. All implementation, testing, migration, rollout, and merge decisions for Blueprint-to-3D work must remain consistent with these documents.

## Control documents

- [`master-plan.md`](./master-plan.md) — product and technical implementation plan, sequencing, acceptance criteria, and long-term architecture.
- [`building-graph-contract.md`](./building-graph-contract.md) — canonical `BosBuildingGraph` contract, invariants, provenance, confidence, correction, and export rules.
- [`benchmark-criteria.md`](./benchmark-criteria.md) — permanent benchmark definitions, pass/fail gates, and Mitchell Dewitt first-floor requirements.
- [`workstream-boundaries.md`](./workstream-boundaries.md) — ownership boundaries between parsing, reconstruction, semantics, validation, corrections, UI, persistence, export, and release work.
- [`phase-status.md`](./phase-status.md) — live phase checklist and current implementation state.
- [`execution-merge-rules.md`](./execution-merge-rules.md) — mandatory development, CI, migration, merge, deployment, and Production-verification rules.

## Governing principle

The Blueprint Engine must never present a visibly incomplete, wrong-sheet, incorrectly scaled, or topologically invalid reconstruction as a successful 3D result. When confidence is insufficient, the system must explicitly enter `needs_review`, `needs_input`, or `failed` and preserve the evidence needed to improve the reconstruction.

## Change discipline

Any material change to Blueprint Engine architecture, object contracts, benchmark thresholds, phase ownership, or release policy must update this directory in the same branch/PR as the code change. The code is not considered complete if this control structure is stale.
