# Contract Compliance Roadmap

## Completed foundation

- Phase 1: Ohio home-construction contract readiness and server-side send gate.
- Phase 2: Ohio home-solicitation classification, notices, signing controls, cancellation intake, work-start hold, release guard, and audit evidence.

## Completed expansion phases

1. Contract document assembly: structured compliance facts and applicable statutory notices are preserved in the immutable agreement snapshot/PDF rather than relying on operational metadata alone.
2. Payment/deposit controls: deposit limits and special-order exceptions are enforced at payment collection, not only at contract review.
3. Change-order controls: signed written-change and excess-cost rules apply to post-contract scope/cost changes.
4. Operational start controls: the shared work-start guard protects operational execution channels and preserves every decision as evidence.
5. Evidence center: compliance evidence is exposed through a unified, read-only internal audit timeline while source records remain authoritative.
6. Jurisdiction packs: Ohio rules are isolated in a deployment-controlled, versioned pack with effective-date metadata so future state/local packs can be added without mixing legal logic.
7. Counsel review workflow: an authorized company administrator can record counsel or authorized human review with reviewer identity, scope, timestamp, disposition, ruleset version, and jurisdiction-pack provenance without weakening deterministic statutory gates.

Contract document assembly, Payment/deposit controls, Change-order controls, Operational start controls, Evidence center, Jurisdiction packs, and Counsel review workflow each retain regression coverage and server-side enforcement as release requirements.
