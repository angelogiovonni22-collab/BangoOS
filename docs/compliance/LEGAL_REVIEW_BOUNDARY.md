# Legal Review Boundary

B.O.S. may automate deterministic workflow controls, evidence preservation, notice assembly, deadline calculations, and known statutory checks. It must not represent that software alone guarantees a contract is enforceable or legally sufficient in every circumstance.

When facts are ambiguous, a statute requires a human act B.O.S. cannot independently perform, a transaction falls on a statutory boundary, or a rule pack is missing/expired, the system must return `REVIEW_REQUIRED` and preserve the reason. A future counsel-review workflow may record reviewer identity, scope, timestamp, and disposition, but it must not silently override deterministic hard blocks without an explicit, auditable exception mechanism designed for that rule.
