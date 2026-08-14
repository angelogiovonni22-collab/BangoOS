# Phase 2 Release Checklist

- [x] Applicability classifier fails safely on unknown facts.
- [x] Ohio business-day deadline calculator covered by regression tests.
- [x] Cancellation notice data and duplicate-notice configuration modeled.
- [x] Seller-signature and assisted/live-signing controls modeled.
- [x] Secure public cancellation endpoint records evidence.
- [x] Timely cancellation voids estimate and holds linked project.
- [x] Active cancellation window creates a work-start hold.
- [x] Hold cannot release before the deadline or after cancellation.
- [x] Append-only compliance event schema and writer exist.
- [x] Internal estimate compliance panel exists.
- [x] Public contract experience exposes cancellation workflow.
- [x] Server-side send gate prevents bypass by UI/Orion.
- [x] Phase 2 tests are part of `npm run check`.

Phase 2 is complete when CI passes this branch and the PR is merged to `main`.
