# Purchasing write-permission guard — 2026-10-06

Actual production rollback reproduced a read-only superintendent approving a zero-cost purchase order through the transition RPC. Legacy role allowlists also ignored explicit `materials.manage` revocations.

Add restrictive INSERT/UPDATE/DELETE policies requiring canonical `materials.manage` on orders, order lines, receipts, allocations, project material plans and fulfillment operation records. Existing permissive policies, financial reporting reads, field material request creation and financial-view requirements remain in force. No function privilege escalation or RLS bypass.

Production authenticated rollback tests passed:
- Default superintendent, office manager and accountant cannot approve through the RPC or direct UPDATE; draft remains unchanged.
- Project manager with explicit materials.manage=false cannot approve through either path.
- Default project manager still completes supplier-plan draft, approval, issue, receipt and allocation with correct actors and zero synthetic costs.
- Superintendent with explicit materials.manage=true can approve a freeform zero-cost order; no persistent permission change.
- Post-test account restored administrator with empty overrides; material archived/not tracked/stock0; temporary cost codes and orders absent.

PGlite reproduces the original approval defect, verifies denials after migration and positive grant/default-manager transitions. Suite passed. Lint zero errors/27 existing warnings. Existing app build and 77 primary contract tests apply to unchanged app source. Linked CLI dry run attempted and failed ProjectRefNotLinkedError; not counted as passed. Security advisors unchanged (3 internal INFO, pg_net warning, 1 anonymous/42 authenticated existing security-definer warnings).

Applied SQL MD5 64c88e859bfab8dd3f5281fc50f90bbc; connector history20261006223413 aligned to CLI-generated20261006223258 after exact name/hash verification without SQL replay.

Not full role/session acceptance: grants to roles excluded by legacy permissive policies/RPC role lists require separate verification. Fresh browser role sessions, receipt corrections/reversals, true overlapping concurrency and the remaining BOS register are still open.
