# Purchasing permissions audit — 2026-10-06

Project managers already have canonical `materials.manage`, but legacy UPDATE policies prevented purchasing row locks on vendors, supplier prices, materials and cost codes. The actual production synthetic administrator account, temporarily restricted to project manager inside a rollback, reproduced the inventory receipt failure.

The migration adds permission-scoped inventory updates and vendor/price row-lock policies whose WITH CHECK false prevents supplier mutations. A cost-code trigger limits roles without general financial edit rights to exact purchasing-derived totals, verifies unchanged budget/ownership fields, and stamps the authenticated actor. All new functions are invoker functions with a fixed search path; no RLS bypass or privileged grants were added.

Validation:
- Production rollback: owner creates a synthetic confirmed supplier price, material requirement and zero-budget cost code; synthetic project manager creates a draft, approves, issues, receives 0.5 and allocates 0.5. Stock and costs finish at zero, order is fully received and actors match the project manager.
- Supplier and price changes, budget edits, fabricated cost totals and another-company RPC access are rejected.
- Post-rollback administrator role restored, stock zero, no temporary cost code or order retained.
- PGlite suite models UPDATE RLS and covers role overrides, read-only superintendent, supplier immutability, cost/actor guards, draft and fulfillment regression cases.
- Lint: zero errors, 27 existing warnings. Existing successful app build and 77 primary contract tests apply; no application source changed.
- Security advisors unchanged: three internal RLS/no-policy informational findings, pg_net public-extension warning, one anonymous and 42 authenticated existing security-definer warnings.
- Linked CLI dry run remains blocked by missing project linkage; do not claim it passed.

Applied migration exact MD5: `e9de5f64700387b7c9e0bafe237fe8fa`. Connector history version was aligned from 20261006222606 to CLI-generated 20261006222311 after verifying exact name and SQL hash; no SQL was replayed.

Limits: database authenticated-role tests are not a fresh project-manager browser session. Actual concurrent overlapping production transactions, receipt correction/reversal, retention/deletion process, and the remaining BOS completion register remain open. No overall 100% completion claim.
