# Labor plan reconciliation in financial reports

The canonical project report and company rollup include existing project employee/crew plans as a pooled project labor forecast. The database's generated `projected_cost` is the source; individual plan lines remain additive, matching the existing project commitment controls.

- Outstanding labor commitment = max(project planned labor − accessible approved/exported payroll allocated to that project, 0).
- Actual labor remains the existing approved payroll snapshot. Planning entries and their manually entered actual hours/cost overrides are not a second actual-wage ledger.
- Forecast retains the existing total-budget floor and actual-plus-outstanding-commitment floor. Labor category and report/company totals use the same outstanding amount.
- Payroll on another project, unassigned payroll, and historical payroll without supported project snapshots cannot consume this project's plan.
- This is a pooled dollar forecast, not worker-specific matching or proof of wages owed. The existing payroll source still excludes employer taxes and benefits. No liability, payment, invoice or customer contract is created or changed by a report read.
- A project labor commitment is a project-level plan, not a single shift. Cancelling or moving a schedule entry does not silently delete that project plan. Reducing/releasing that plan is a separate project compensation operation.

Use the existing payroll access gate before reading plans. If payroll costs are unavailable to the caller, exclude both wages and plan reconciliation and explicitly mark the source unavailable; do not assume no payroll exists. Reads retain the authenticated client and company/project predicates, stable 500-row pagination, RLS and fail-on-any-page-error behavior. No grants, policies or schema changes.

Behavioral acceptance covers empty/partial/fully consumed/overrun plans, decimal amounts, manual actual exclusion, project/company parity, foreign-company and other-project exclusion, 1,501 plans, unavailable/malformed sources and restricted wage access. Live owner acceptance uses the existing labeled pilot plan ($80 with no payroll); it must show $80 outstanding labor and preserve the independently confirmed AP lifecycle and $120 customer contract. An approved $20 bill remains $20 actual; if that fixture bill is already voided, actual cost remains $0. Leave all underlying financial records unchanged.
