# Phase 3 — Contract Document Assembly

Phase 3 moves compliance from metadata/gates into the immutable customer agreement itself.

Acceptance criteria:

- Structured compliance facts are mapped into the agreement snapshot.
- Applicable Ohio cancellation notice is rendered as part of the customer document package.
- Seller identity/address and transaction/cancellation dates come from stored structured data, not freehand duplication.
- The signed snapshot preserves the exact compliance ruleset/version used at assembly time.
- Required notices are hash-covered by the same immutable agreement evidence as the commercial terms.
- Missing required document data blocks assembly/send rather than producing a partial legal packet.
- Customer receives a single professional package with one primary review/sign action.
- Regression tests verify the notice and compliance manifest cannot be omitted from applicable snapshots.
