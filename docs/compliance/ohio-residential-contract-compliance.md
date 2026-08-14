# Ohio Residential Contract Compliance

B.O.S. treats legal compliance as a versioned decision-support and workflow-control layer, not as a guarantee of enforceability or a substitute for counsel.

## Phase 1 — Home construction contract readiness

The send gate evaluates Ohio home-construction contract requirements, preserves the ruleset/version used, stores the editable compliance profile separately from append-only evaluation history, and blocks public-token generation/email delivery when the result is not `COMPLIANT`.

## Phase 2 — Home solicitation / cancellation lifecycle

B.O.S. separately classifies whether the Ohio Home Solicitation Sales Act workflow may apply. Ambiguous classifications remain `REVIEW_REQUIRED` rather than being inferred. For applicable transactions the workflow supports:

- seller and buyer notice data;
- duplicate cancellation-notice configuration;
- seller signature workflow;
- assisted/live-signing and oral-disclosure confirmation;
- Ohio business-day cancellation deadline calculation;
- secure-link cancellation intake and immutable cancellation records;
- work-start hold through the cancellation deadline;
- cancelled-contract project hold;
- safe release only after the deadline when no cancellation exists;
- append-only compliance event history.

## Operational rule

A signed contract is not necessarily cleared for field work. Downstream scheduling, dispatch, procurement, time-entry, and project-start workflows should call the server-side work-start guard before initiating performance when the estimate is linked to a compliance-controlled contract.

## Rules maintenance

Legal rules must remain versioned and sourced. Material changes to Ohio law should create a new ruleset version and regression cases rather than silently rewriting historical decisions.
