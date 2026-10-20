# Scheduling reliability — October 20, 2026

## Behavior

Assignment creation now uses one authenticated, SECURITY INVOKER RPC for the schedule and optional crew compensation. Any compensation failure rolls back the assignment and every plan write. Existing workforce and labor-plan RLS remain authoritative; payroll plans use current server-side crew membership, hourly rates, and fringe. Pooled project plans still replace their existing planning values; this does not create wages or payroll runs. Cancellation does not silently remove a project-wide labor plan.

The client retains the request UUID after failure. The server serializes retries, checks a SHA-256 request fingerprint, and returns the original assignment for an identical retry. Different details under the same UUID are rejected. Resource advisory locks serialize overlap checks between creates through this RPC. Legacy clients and other direct update paths retain their existing overlap behavior; this is not a database-wide exclusion constraint.

New nullable assignment fields retain selected kind, required headcount and trade. Older rows keep their historical inference until edited; no backfill changes their meaning. Publish now defaults to Published/confirmed; editing preserves the existing status. Operations counts each staffing gap once, excludes terminal rows from today's active workspace, uses the company date, and displays recorded shift duration instead of assuming eight hours. Crew profile timestamps explicitly use the company time zone. Scheduling KPI footnotes state that no prior-period comparison is available.

## Validation

- Actual-schema rollback suite: `supabase/tests/atomic-scheduling-compensation.sql`, run after the migration inside one transaction ending in ROLLBACK. Uses only the labelled pilot, temporary test employees/rates, and a transactional fault trigger. Covers compensation failure, second payroll row failure, no partial plans, existing-plan preservation, current server rates/fringe, authenticated RLS, same-request replay, changed retry, overlap rejection, cancelled-history reuse, invalid quantity, empty payroll crew, cross-company/nonmember and anonymous execution rejection. No test setup is committed.
- Actual-code Node 24 workforce-summary and lifecycle suites pass; summary also passes with `TZ=Asia/Tokyo`. Temporary mirrors change only import extensions, not logic. The dedicated workforce summary suite is added to CI.
- Project commitments contract passes with the new single-save boundary. `git diff --check` passes.
- Local lint attempted: eslint is unavailable. No npm install performed. Repository CI is the full lint/build/contract/dependency gate.
- Supabase CLI-generated migration; linked dry-run is attempted separately. Reviewed migration must be applied before the new application code is promoted.

## Production acceptance steps

1. Confirm exact Production commit and alias in Vercel after CI passes and merge.
2. Compare Schedule and Operations open assignment counts; verify the pilot's two-hour duration and retained cancelled history. Inspect layouts and keyboard-accessible controls.
3. From the synthetic crew, reject empty-payroll submission and an overlap; confirm no extra assignment/plan. Create a separate labelled synthetic hourly assignment at a free time; verify the schedule and compensation saved together. Preserve/reconcile the pilot's existing $80 project-wide plan.
4. Reload and edit the synthetic schedule: kind, required trade/headcount, Published status, date/time and cancellation must round-trip. Cancel the disposable assignment through the supported UI and retain history.
5. Confirm crew timestamps match company time, then verify project/company finances, invoice safeguards and Orion health remain unchanged after restoring any modified pilot plan values.

The earlier receipt/event replay and thirteen payment/publisher checks remain complete and are not manually repeated. Full-product role/device/provider acceptance and older pilot closeout remain separate gates.
