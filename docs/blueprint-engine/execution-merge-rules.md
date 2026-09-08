# Blueprint Engine Execution and Merge Rules

These rules govern all Blueprint Engine work unless a later user instruction explicitly overrides them.

## Execution model

Work proceeds automatically through:

`audit → implementation/fixes → targeted tests → full validation → commit/push → CI → auto-fix failures → merge when green → Supabase migrations/functions → Production verification → strongest safe E2E/benchmark → next phase`

Do not stop for routine progress updates or permission between phases.

Stop only when:

1. information, credentials, hardware, or access only the user can provide is required;
2. an action is destructive, irreversible, financially consequential, or affects a real customer;
3. product intent is genuinely ambiguous and cannot be resolved from this control structure, repo state, or existing product behavior;
4. a hard tool/platform limitation blocks continuation.

## Source-of-truth rules

- `docs/blueprint-engine/` governs the Blueprint Engine implementation.
- Material architectural changes must update the relevant control document in the same branch/PR.
- Executable contracts must remain consistent with documented benchmark thresholds.
- Do not create parallel, undocumented reconstruction paths.

## Branch and PR rules

- Use feature branches; do not develop directly on `main`.
- Keep related Blueprint Engine work in the active Blueprint Engine PR when changes are part of the same release unit.
- Do not merge while required CI is pending or failing.
- Auto-fix normal lint, TypeScript, build, contract, migration, or test failures and re-run gates.
- If the branch falls behind `main`, update/rebase/merge main only when necessary to validate or merge safely.

## Test rules

Before merge, run the strongest available combination of:

- Blueprint Engine unit/contract tests;
- automatic Blueprint-to-3D contract;
- lint;
- TypeScript/build validation through the repository check;
- UI Audit Gate;
- Spanish Localization gate;
- Reviewer Access gate;
- Commercial Launch Security gate;
- BangoOS Check;
- benchmark-specific tests;
- Production visual verification after deployment.

A passing build does not override a failing benchmark.

## Migration rules

- Schema changes require forward-only Supabase migrations.
- RLS must remain enabled for tenant-scoped Blueprint Engine tables.
- Migrations must be idempotent where practical and safe to apply to the existing Production schema.
- Do not drop user data or destructive columns as part of normal Blueprint Engine phases.
- Apply/verify migrations before Production code relies on the new columns/tables.

## Reconstruction safety rules

- Never mark a native reconstruction `3D Ready` merely because serialization succeeded.
- `reconstructed` requires validation success.
- Wrong-sheet, unknown scale, severe under-tracing, rectangle collapse, or topology failure must withhold success.
- User corrections must be preserved and replayed where compatible.
- Correction conflicts must be surfaced, not silently discarded.
- AI-assisted geometry is advisory unless reconciled into the canonical graph with evidence and validation.

## Merge acceptance

Merge is allowed only when:

- PR is mergeable;
- required CI gates are green;
- active-phase targeted contracts pass;
- migrations needed by merged code are ready to apply;
- no known benchmark regression is being hidden by status/UI behavior;
- control docs reflect the implemented state.

## Production acceptance

After merge:

1. wait for Vercel Production green;
2. apply/verify required Supabase migrations/functions;
3. verify API behavior against Production;
4. run the strongest safe authenticated Blueprint workflow available;
5. verify benchmark-critical visuals when browser access is available;
6. record the outcome in `phase-status.md` in the next development branch if follow-up work is needed;
7. continue automatically to the next incomplete phase.

## Real-customer safety

Do not trigger customer emails, payments, payroll, destructive deletes, irreversible document actions, or other real-customer side effects during Blueprint Engine testing unless explicitly authorized.