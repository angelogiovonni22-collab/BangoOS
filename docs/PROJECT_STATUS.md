# B.O.S. Project Status

Date: 2026-08-06
Branch: feature/bos-3d-command-center
Commit: c31e6bc
Worktree: DIRTY (many unrelated modified/untracked files present)

## Stabilization Scope
This batch focused on freezing active Orion voice automation and producing a completion audit/roadmap.

- No migrations run.
- No resolver/customer-matching redesign.
- No OpenAI Realtime migration.
- No commit/push/deploy.

## Voice Freeze Status
Status: IMPLEMENTED (default off)

Canonical flag:
- NEXT_PUBLIC_ORION_VOICE_AUTOMATION
- Enabled only when value is 1
- Default behavior when missing or non-1: voice automation disabled

Canonical config source:
- lib/orion/runtime-config.ts

Freeze message:
- Voice temporarily disabled for stabilization.

Guarded entry points in provider:
- Microphone startup gate: requestVoiceStart
- Manual capture gate: startVoiceCapture
- Command mode gate: startVoiceCommandMode
- Wake continuation gate: startWakeContinuation
- Transcript processing and voice workflow request gate: handleTranscript
- Hands-free/background restart gate: voice.state idle restart effect
- Visibility resume gate: visibilitychange handler
- Catalog background fetch gate: fetchCatalog effect
- Inactivity loop gate: command inactivity effect
- Hands-free error reactivation effects gate

UI honesty behavior while frozen:
- Phase forced to disabled
- Error category cleared to null
- Status message forced to freeze message
- Effective context settings expose enabled: false while frozen

## Request Stability Findings
Runtime constraints:
- Another Next dev server instance was already running, and new dev startup exits early with a conflict warning.
- Shared browser pages were not in a stable authenticated test session for full per-page 10s observation.

Observed runtime evidence from next-development.log:
- Repeated recognition start/end/no-speech cycles in hands_free mode before freeze.
- Visibility-triggered restarts also present before freeze.
- This behavior is now blocked by the freeze gate.

Supabase endpoint loop trace status in this batch:
- auth/v1/user: not reliably re-observed in controlled 10s-per-page run (runtime constraint).
- profiles: not reliably re-observed in controlled 10s-per-page run (runtime constraint).
- companies: not reliably re-observed in controlled 10s-per-page run (runtime constraint).
- workflow_events: not reliably re-observed in controlled 10s-per-page run (runtime constraint).
- projects: not reliably re-observed in controlled 10s-per-page run (runtime constraint).
- customers: not reliably re-observed in controlled 10s-per-page run (runtime constraint).
- crews: not reliably re-observed in controlled 10s-per-page run (runtime constraint).
- equipment: not reliably re-observed in controlled 10s-per-page run (runtime constraint).

Code-level loop risk analysis (high-confidence static):
- FIRST stabilization blocker candidate:
  - lib/operations/use-operations.ts
  - Pattern: default parameter service = createOperationsService() with effect dependency on refresh -> refresh depends on service -> new service identity per render can retrigger effect and repeated fetches.
- Additional loop-risk owners:
  - lib/scheduling/use-scheduling.ts
  - lib/employees/use-employee-profile.ts
- Stable patterns already present in daily reports hooks:
  - lib/daily-reports/use-daily-reports.ts
  - lib/daily-reports/use-daily-report.ts

## Route Audit (Page-by-Page)
Legend for Current Status:
- COMPLETE
- Functional but incomplete
- Broken
- Placeholder
- Not tested

### Foundation

1) Route: /login
- Purpose: user sign-in
- Current status: Functional but incomplete
- Visual quality: good
- Data source: Supabase auth
- Loading state: yes
- Empty state: n/a
- Error state: yes
- Create/view/edit/archive: n/a
- Permissions: auth gate implicit
- Company isolation: n/a pre-login
- Console errors: not tested live
- Network/request behavior: not fully verified live
- Mobile/tablet behavior: code suggests responsive
- Automated test coverage: partial indirect
- Owner browser test required: yes
- Files: app/login/page.tsx

2) Route: /signup
- Purpose: user registration
- Current status: Functional but incomplete
- Visual quality: good
- Data source: Supabase auth
- Loading state: yes
- Empty state: n/a
- Error state: yes
- Create/view/edit/archive: create only
- Permissions: public
- Company isolation: n/a pre-company
- Console errors: not tested live
- Network/request behavior: not fully verified live
- Mobile/tablet behavior: code suggests responsive
- Automated test coverage: limited
- Owner browser test required: yes
- Files: app/signup/page.tsx

3) Route: /auth/confirm
- Purpose: auth callback/verification
- Current status: Not tested
- Visual quality: unknown
- Data source: Supabase auth callback
- Loading state: unknown
- Empty state: unknown
- Error state: unknown
- Create/view/edit/archive: n/a
- Permissions: auth callback
- Company isolation: n/a
- Console errors: not tested
- Network/request behavior: not tested
- Mobile/tablet behavior: not tested
- Automated test coverage: unknown
- Owner browser test required: yes
- Files: app/auth/confirm/page.tsx

4) Route: /onboarding
- Purpose: company/workspace bootstrap
- Current status: Functional but incomplete
- Visual quality: good
- Data source: profiles, companies via Supabase
- Loading state: yes
- Empty state: n/a
- Error state: yes
- Create/view/edit/archive: create/update workspace records
- Permissions: authenticated user required
- Company isolation: owner scoped on create/update
- Console errors: not tested live
- Network/request behavior: not fully verified live
- Mobile/tablet behavior: likely responsive
- Automated test coverage: limited
- Owner browser test required: yes
- Files: app/onboarding/page.tsx

5) Route: /(app) shell
- Purpose: authenticated shell/navigation/orion mount
- Current status: STABLE V1 for layout; Orion voice now frozen
- Visual quality: good
- Data source: i18n, nav config
- Loading state: n/a
- Empty state: n/a
- Error state: n/a
- Create/view/edit/archive: n/a
- Permissions: shell around authenticated routes
- Company isolation: handled downstream
- Console errors: not fully verified live
- Network/request behavior: stable in contract tests
- Mobile/tablet behavior: covered by shell tests
- Automated test coverage: strong
- Owner browser test required: yes
- Files: app/(app)/app-shell.tsx

6) Route: /settings
- Purpose: settings and memory review link and Orion voice settings panel
- Current status: Functional but incomplete
- Visual quality: good
- Data source: local UI + memory review API link
- Loading state: minimal
- Empty state: n/a
- Error state: limited
- Create/view/edit/archive: settings edits
- Permissions: authenticated
- Company isolation: n/a for local settings
- Console errors: not tested live
- Network/request behavior: not fully verified live
- Mobile/tablet behavior: likely responsive
- Automated test coverage: limited
- Owner browser test required: yes
- Files: app/(app)/settings/page.tsx

### Dashboard

7) Route: /dashboard
- Purpose: executive dashboard
- Current status: Functional but incomplete
- Visual quality: high
- Data source: lib/dashboard useExecutiveDashboard
- Loading state: yes
- Empty state: partial
- Error state: yes
- Create/view/edit/archive: widget customization
- Permissions: workspace/auth required
- Company isolation: expected by workspace context
- Console errors: not fully verified live
- Network/request behavior: not fully verified live
- Mobile/tablet behavior: likely good but owner verification needed
- Automated test coverage: moderate via module tests
- Owner browser test required: yes
- Files: app/(app)/dashboard/page.tsx

### Operations

8) Route: /operations
- Purpose: operations command center
- Current status: Functional but incomplete (loop-risk owner)
- Visual quality: good
- Data source: useOperationsCommandCenter
- Loading state: yes
- Empty state: partial
- Error state: yes
- Create/view/edit/archive: operational actions via service
- Permissions: workspace required
- Company isolation: expected
- Console errors: not fully verified live
- Network/request behavior: loop-risk depends on hook/service patterns
- Mobile/tablet behavior: not fully verified
- Automated test coverage: moderate
- Owner browser test required: yes
- Files: app/(app)/operations/page.tsx, lib/operations/use-operations-command-center.ts

9) Route: /timeline
- Purpose: Orion timeline feed
- Current status: Functional but incomplete
- Visual quality: good
- Data source: workflow_events timeline service
- Loading state: yes
- Empty state: yes
- Error state: yes
- Create/view/edit/archive: view/filter only
- Permissions: workspace required
- Company isolation: explicit companyId usage
- Console errors: not fully verified live
- Network/request behavior: likely stable, not fully observed
- Mobile/tablet behavior: not fully verified
- Automated test coverage: moderate
- Owner browser test required: yes
- Files: app/(app)/timeline/page.tsx

10) Route: /dispatch and /dispatch/forecast
- Purpose: scheduling dispatch board and forecast
- Current status: Functional but incomplete
- Visual quality: good
- Data source: scheduling services
- Loading state: yes
- Empty state: partial
- Error state: yes
- Create/view/edit/archive: assignment operations
- Permissions: workspace required
- Company isolation: expected
- Console errors: not fully verified live
- Network/request behavior: loop-risk due scheduling hook pattern
- Mobile/tablet behavior: not fully verified
- Automated test coverage: navigation contracts present
- Owner browser test required: yes
- Files: app/(app)/dispatch/page.tsx, app/(app)/dispatch/forecast/page.tsx, lib/scheduling/use-scheduling.ts

11) Route: /schedule
- Purpose: schedule calendar workspace
- Current status: Functional but incomplete
- Visual quality: good
- Data source: scheduling services
- Loading state: yes
- Empty state: partial
- Error state: yes
- Create/view/edit/archive: assignment operations
- Permissions: workspace required
- Company isolation: expected
- Console errors: not fully verified live
- Network/request behavior: loop-risk due scheduling hook pattern
- Mobile/tablet behavior: not fully verified
- Automated test coverage: strong navigation regression
- Owner browser test required: yes
- Files: app/(app)/schedule/page.tsx, lib/scheduling/use-scheduling.ts

12) Route: /daily-reports, /daily-reports/new, /daily-reports/[id], /daily-reports/[id]/edit
- Purpose: daily report lifecycle
- Current status: IN PROGRESS (stability improved)
- Visual quality: improving
- Data source: daily-reports services
- Loading state: yes
- Empty state: yes
- Error state: yes
- Create/view/edit/archive: create/view/edit present
- Permissions: workspace required
- Company isolation: expected
- Console errors: not fully verified live
- Network/request behavior: request-loop tests now pass
- Mobile/tablet behavior: not fully verified
- Automated test coverage: strong recent contract/regression tests
- Owner browser test required: yes
- Files: app/(app)/daily-reports/page.tsx, app/(app)/daily-reports/new/page.tsx, app/(app)/daily-reports/[id]/page.tsx, app/(app)/daily-reports/[id]/edit/page.tsx

13) Route: /projects and /projects/new and /projects/[id]
- Purpose: project lifecycle and workspace
- Current status: Functional but incomplete
- Visual quality: high
- Data source: projects, customers, tasks, invoices, workflow_events
- Loading state: yes
- Empty state: yes
- Error state: yes
- Create/view/edit/archive: create and view present; edit flows partial via workspace tabs
- Permissions: workspace required
- Company isolation: explicit company filters throughout
- Console errors: not fully verified live
- Network/request behavior: not fully observed for loop risk
- Mobile/tablet behavior: not fully verified
- Automated test coverage: moderate
- Owner browser test required: yes
- Files: app/(app)/projects/page.tsx, app/(app)/projects/new/page.tsx, app/(app)/projects/[id]/page.tsx

### Customers

14) Route: /customers
- Purpose: customer directory with filtering
- Current status: STABLE V1
- Visual quality: good
- Data source: customers table + workspace context
- Loading state: yes
- Empty state: yes
- Error state: yes
- Create/view/edit/archive: list and navigation
- Permissions: workspace required
- Company isolation: explicit company filter
- Console errors: not fully verified live
- Network/request behavior: appears bounded in hook/page pattern
- Mobile/tablet behavior: not fully verified
- Automated test coverage: good customer workflow/intent tests
- Owner browser test required: yes
- Files: app/(app)/customers/page.tsx

15) Route: /customers/new
- Purpose: customer creation
- Current status: STABLE V1
- Visual quality: good
- Data source: customer service createCustomer
- Loading state: submit state
- Empty state: n/a
- Error state: yes
- Create/view/edit/archive: create
- Permissions: workspace required
- Company isolation: companyId passed
- Console errors: not fully verified live
- Network/request behavior: appears bounded
- Mobile/tablet behavior: not fully verified
- Automated test coverage: good via workflow/intent and domain tests
- Owner browser test required: yes
- Files: app/(app)/customers/new/page.tsx, lib/customers/*

16) Route: /customers/[id]
- Purpose: customer detail with related records/timeline
- Current status: Functional but incomplete
- Visual quality: high
- Data source: customers, projects, estimates, invoices, change_orders, project_photos, timeline
- Loading state: yes
- Empty state: yes
- Error state: yes
- Create/view/edit/archive: view + related navigation
- Permissions: workspace required
- Company isolation: explicit company filters
- Console errors: not fully verified live
- Network/request behavior: multi-query; no full 10s runtime trace completed
- Mobile/tablet behavior: not fully verified
- Automated test coverage: partial
- Owner browser test required: yes
- Files: app/(app)/customers/[id]/page.tsx

17) Route: /customers/[id]/edit
- Purpose: customer update
- Current status: STABLE V1
- Visual quality: good
- Data source: customer domain update service
- Loading state: yes
- Empty state: yes (not found path)
- Error state: yes
- Create/view/edit/archive: edit
- Permissions: workspace required
- Company isolation: explicit company filters and companyId parameter
- Console errors: not fully verified live
- Network/request behavior: appears bounded
- Mobile/tablet behavior: not fully verified
- Automated test coverage: partial
- Owner browser test required: yes
- Files: app/(app)/customers/[id]/edit/page.tsx

### Financial

18) Route: /estimates, /estimates/new, /estimates/[id], /estimates/[id]/edit
- Purpose: estimate lifecycle
- Current status: Functional but incomplete
- Visual quality: good
- Data source: estimate services/components
- Loading state: yes
- Empty state: yes
- Error state: yes
- Create/view/edit/archive: create/view/edit present
- Permissions: workspace required
- Company isolation: expected
- Console errors: not fully verified live
- Network/request behavior: not fully observed
- Mobile/tablet behavior: not fully verified
- Automated test coverage: moderate
- Owner browser test required: yes
- Files: app/(app)/estimates/page.tsx, app/(app)/estimates/new/page.tsx, app/(app)/estimates/[id]/page.tsx, app/(app)/estimates/[id]/edit/page.tsx

19) Route: /invoices, /invoices/new, /invoices/[id], /invoices/[id]/edit, /invoices/[id]/print
- Purpose: invoice lifecycle
- Current status: Functional but incomplete
- Visual quality: good
- Data source: invoice services/components
- Loading state: yes
- Empty state: yes
- Error state: yes
- Create/view/edit/archive: create/view/edit/print
- Permissions: workspace required
- Company isolation: expected
- Console errors: not fully verified live
- Network/request behavior: not fully observed
- Mobile/tablet behavior: not fully verified
- Automated test coverage: moderate
- Owner browser test required: yes
- Files: app/(app)/invoices/page.tsx, app/(app)/invoices/new/page.tsx, app/(app)/invoices/[id]/page.tsx, app/(app)/invoices/[id]/edit/page.tsx, app/(app)/invoices/[id]/print/page.tsx

20) Route: /change-orders, /change-orders/new, /change-orders/[id], /change-orders/[id]/edit, /change-orders/[id]/print
- Purpose: change order lifecycle
- Current status: Functional but incomplete
- Visual quality: good
- Data source: change-order services/components
- Loading state: yes
- Empty state: yes
- Error state: yes
- Create/view/edit/archive: create/view/edit/archive/restore/print
- Permissions: workspace required
- Company isolation: expected
- Console errors: not fully verified live
- Network/request behavior: not fully observed
- Mobile/tablet behavior: not fully verified
- Automated test coverage: moderate
- Owner browser test required: yes
- Files: app/(app)/change-orders/page.tsx, app/(app)/change-orders/new/page.tsx, app/(app)/change-orders/[id]/page.tsx, app/(app)/change-orders/[id]/edit/page.tsx, app/(app)/change-orders/[id]/print/page.tsx

### Workforce / Resources

21) Route: /employees and /employees/[id]
- Purpose: employee directory/profile
- Current status: Functional but incomplete
- Visual quality: good
- Data source: employee service hooks
- Loading state: yes
- Empty state: yes
- Error state: yes
- Create/view/edit/archive: view only; create/edit placeholders
- Permissions: workspace required
- Company isolation: expected
- Console errors: not fully verified live
- Network/request behavior: loop-risk in use-employee-profile default service pattern
- Mobile/tablet behavior: not fully verified
- Automated test coverage: moderate
- Owner browser test required: yes
- Files: app/(app)/employees/page.tsx, app/(app)/employees/[id]/page.tsx, lib/employees/use-employee-profile.ts

22) Route: /employees/new and /employees/[id]/edit
- Purpose: employee create/edit
- Current status: Placeholder
- Visual quality: acceptable placeholder
- Data source: none (read-only notice)
- Loading state: n/a
- Empty state: n/a
- Error state: minimal
- Create/view/edit/archive: deferred
- Permissions: workspace required
- Company isolation: n/a
- Console errors: not tested
- Network/request behavior: no major fetch path
- Mobile/tablet behavior: not verified
- Automated test coverage: limited
- Owner browser test required: yes
- Files: app/(app)/employees/new/page.tsx, app/(app)/employees/[id]/edit/page.tsx

23) Route: /crews and /crews/[id]
- Purpose: crew directory/profile
- Current status: Functional but incomplete
- Visual quality: good
- Data source: crew service hooks
- Loading state: yes
- Empty state: yes
- Error state: yes
- Create/view/edit/archive: view only in phase, create/edit placeholders
- Permissions: workspace required
- Company isolation: expected
- Console errors: not fully verified live
- Network/request behavior: not fully observed
- Mobile/tablet behavior: not fully verified
- Automated test coverage: moderate
- Owner browser test required: yes
- Files: app/(app)/crews/page.tsx, app/(app)/crews/[id]/page.tsx

24) Route: /crews/new and /crews/[id]/edit
- Purpose: crew create/edit
- Current status: Placeholder
- Visual quality: acceptable placeholder
- Data source: none (read-only notice)
- Loading state: n/a
- Empty state: n/a
- Error state: minimal
- Create/view/edit/archive: deferred
- Permissions: workspace required
- Company isolation: n/a
- Console errors: not tested
- Network/request behavior: no major fetch path
- Mobile/tablet behavior: not verified
- Automated test coverage: limited
- Owner browser test required: yes
- Files: app/(app)/crews/new/page.tsx, app/(app)/crews/[id]/edit/page.tsx

25) Routes: /equipment, /materials, /vendors, /units-of-measure, /cost-codes, /labor-rates (+ detail/edit/new)
- Purpose: resource/master data modules
- Current status: Functional but incomplete
- Visual quality: good
- Data source: module-specific services via server-access wrappers
- Loading state: expected in client pages
- Empty state: expected
- Error state: expected
- Create/view/edit/archive: mostly present per module, owner verification pending
- Permissions: server access checks exist
- Company isolation: expected by service and server-access
- Console errors: not fully verified live
- Network/request behavior: not fully observed
- Mobile/tablet behavior: not fully verified
- Automated test coverage: partial
- Owner browser test required: yes
- Files: app/(app)/equipment/*, app/(app)/materials/*, app/(app)/vendors/*, app/(app)/units-of-measure/*, app/(app)/cost-codes/*, app/(app)/labor-rates/*

### Other

26) Route: /settings/memory-review
- Purpose: memory review/admin
- Current status: Functional but incomplete
- Visual quality: good
- Data source: /api/bango-intelligence/memories
- Loading state: yes
- Empty state: yes
- Error state: yes
- Create/view/edit/archive: view/edit/verify/archive in UI
- Permissions: workspace/auth expected
- Company isolation: API-side expected
- Console errors: not fully verified live
- Network/request behavior: not fully observed
- Mobile/tablet behavior: not fully verified
- Automated test coverage: limited
- Owner browser test required: yes
- Files: app/(app)/settings/memory-review/page.tsx

27) Routes: /labs/mission-control, /labs/orion-core, /labs/quantum
- Purpose: lab/prototype surfaces
- Current status: IN PROGRESS (intentional fixtures)
- Visual quality: high
- Data source: fixtures and isolated components
- Loading state: mostly immediate
- Empty state: n/a
- Error state: minimal
- Create/view/edit/archive: read-only
- Permissions: authenticated app routes
- Company isolation: not applicable for fixture-only pages
- Console errors: not fully verified live
- Network/request behavior: minimal expected
- Mobile/tablet behavior: not fully verified
- Automated test coverage: partial
- Owner browser test required: yes
- Files: app/(app)/labs/mission-control/page.tsx, app/(app)/labs/orion-core/page.tsx, app/(app)/labs/quantum/page.tsx

## Module Completion Matrix
| Module | Status | Blocking bugs | Missing features | Technical debt | Test gaps | Effort | Recommended order |
|---|---|---|---|---|---|---|---|
| Platform stability/request loops | BLOCKED | Potential unbounded loop pattern in operations/employee profile hooks | Controlled runtime observability and loop hardening | Service-creation-in-hook-parameter pattern | Need deterministic loop regression tests for operations/employees | Medium | 1 |
| Navigation/app shell/responsive | STABLE V1 | None critical currently | Final mobile QA and accessibility passes | Complex layering interactions with overlays | More end-to-end nav tests | Small | 2 |
| Customers | STABLE V1 | None critical in current scope | Archive/restore UX hardening and full e2e | Some large page complexity in detail view | More detail-page integration tests | Small | 3 |
| Projects | IN PROGRESS | Potential heavy multi-query data loads | Complete create/edit/closeout flows and e2e | Large workspace component complexity | End-to-end flows and perf tests | Large | 4 |
| Estimates | IN PROGRESS | None confirmed critical | End-to-end estimation workflow hardening | Directory + form service layering | More regression tests for lifecycle states | Medium | 5 |
| Invoices | IN PROGRESS | None confirmed critical | Payment handling UX and reconciliation checks | Similar service layering as estimates | More regression tests for payment states | Medium | 6 |
| Schedule | STABLE V1 | Scheduling render-fetch loop fixed; stable service instance implemented; browser verification passed; no continuing ERR_INSUFFICIENT_RESOURCES observed. | - | - | - | Medium | 7 |
| Dispatch | IN PROGRESS | Shares scheduling loop-risk | Operational board UX completion | Shared scheduling debt | Additional scenario tests | Medium | 8 |
| Daily Reports | STABLE V1 | None critical after recent loop fixes | richer editing and analytics | Some mixed old/new page patterns | Need broader e2e and visual tests | Medium | 9 |
| Workforce/resources | IN PROGRESS | Employees/crews create-edit placeholders | Complete mutation workflows | Read-only phase pathways | CRUD e2e coverage missing | Large | 10 |
| Monitoring/analytics | NOT STARTED | n/a | Sentry/PostHog operational wiring | n/a | no coverage yet | Medium | 11 |
| Orion typed | IN PROGRESS | Known typed-input bug deferred | Final command-center UX and reliability polish | High complexity in overlay state machine | More deterministic behavior tests | Medium | 12 |
| Orion voice realtime migration | NOT STARTED | deferred by policy | OpenAI Realtime integration | existing browser speech stack interim | migration test plan absent | Large | 13 |

## Prioritized Beta Roadmap

### Milestone 1: Platform Stability and Request-Loop Elimination
- Scope: eliminate loop-risk service-instantiation patterns and verify bounded request behavior.
- Definition of done:
  - No unbounded repeated identical Supabase requests on core pages over 30s idle.
  - Operations and Employee profile hooks use stable service references.
  - Voice freeze remains active by default.
- Routes: /dashboard, /operations, /dispatch, /employees/[id], /daily-reports.
- Tests required:
  - request-loop regression tests for operations/employees.
  - existing daily reports request-loop suite remains green.
- Manual acceptance checklist:
  - open each route and idle 30s, verify bounded network requests.
  - switch tabs and return; no uncontrolled fetch storms.
- Git checkpoint: checkpoint/m1-platform-stability
- Exclusions: no feature expansion, no realtime voice migration.

### Milestone 2: Navigation/App Shell/Responsive Hardening
- Scope: final shell polish, mobile/tablet behavior, overlay layering and keyboard sanity.
- Definition of done: app shell/nav tests pass, no layout overlaps, responsive pass on phone/tablet sizes.
- Routes: all /(app) routes.
- Tests required: app-shell mobile scroll, schedule navigation, hydration regressions.
- Manual checklist: open/close sidebar, command center, persistent Orion across breakpoints.
- Git checkpoint: checkpoint/m2-shell-navigation
- Exclusions: no module business logic changes.

### Milestone 3: Customers Completion
- Scope: customer list/create/detail/edit/archive/restore final QA.
- Definition of done: create and edit flows stable, detail related data loads reliably, archive/restore verified.
- Routes: /customers, /customers/new, /customers/[id], /customers/[id]/edit.
- Tests required: customer workflow + customer resolution + domain validations.
- Manual checklist: full CRUD pass in one company, then cross-company isolation check.
- Git checkpoint: checkpoint/m3-customers
- Exclusions: no Orion voice expansion.

### Milestone 4: Projects Completion
- Scope: project lifecycle and workspace tab stability.
- Definition of done: project list/create/detail tabs stable with bounded requests and clear error states.
- Routes: /projects, /projects/new, /projects/[id].
- Tests required: project data aggregation and route interaction tests.
- Manual checklist: create project, link customer, navigate workspace tabs.
- Git checkpoint: checkpoint/m4-projects
- Exclusions: no broad dashboard redesign.

### Milestone 5: Estimates Completion
- Scope: estimate lifecycle stabilization.
- Definition of done: list/create/detail/edit and status transitions verified.
- Routes: /estimates and children.
- Tests required: estimate lifecycle regressions.
- Manual checklist: create estimate, edit, approve/send path.
- Git checkpoint: checkpoint/m5-estimates
- Exclusions: no payment gateway changes.

### Milestone 6: Invoices Completion
- Scope: invoice lifecycle and print paths.
- Definition of done: list/create/detail/edit/print stable, balance calculations verified.
- Routes: /invoices and children.
- Tests required: invoice status and totals regressions.
- Manual checklist: issue invoice, partial payment representation, print preview.
- Git checkpoint: checkpoint/m6-invoices
- Exclusions: no full Stripe rollout.

### Milestone 7: Schedule Completion
- Scope: schedule calendar behavior and assignments.
- Definition of done: calendar and schedule operations stable and bounded.
- Routes: /schedule.
- Tests required: scheduling hook stability and assignment operations tests.
- Manual checklist: create/move assignment, confirm UI refresh correctness.
- Git checkpoint: checkpoint/m7-schedule
- Exclusions: no dispatch redesign.

### Milestone 8: Dispatch Completion
- Scope: dispatch overview and forecast stability.
- Definition of done: dispatch views reliable and data-consistent.
- Routes: /dispatch, /dispatch/forecast.
- Tests required: dispatch state transitions and filtering tests.
- Manual checklist: shift between dispatch views and verify persistence/filtering.
- Git checkpoint: checkpoint/m8-dispatch
- Exclusions: no advanced optimization engine.

### Milestone 9: Daily Reports Enhancements
- Scope: extend stable V1 with richer insights and UX.
- Definition of done: existing loop-safe behavior preserved with improved editor/reporting.
- Routes: /daily-reports and children.
- Tests required: existing request-loop and page-data suites plus new editor cases.
- Manual checklist: create/edit/report timeline and summaries.
- Git checkpoint: checkpoint/m9-daily-reports
- Exclusions: no schema migration for this milestone unless explicitly approved.

### Milestone 10: Workforce/Resources Completion
- Scope: employees, crews, equipment, materials, vendors, units, cost codes, labor rates.
- Definition of done: placeholders replaced where planned and CRUD flows verified.
- Routes: workforce/resource modules.
- Tests required: module CRUD and permission/isolation tests.
- Manual checklist: one full pass per module with create/view/edit/archive where applicable.
- Git checkpoint: checkpoint/m10-workforce-resources
- Exclusions: no cross-module redesign.

### Milestone 11: Monitoring and Analytics
- Scope: operational telemetry instrumentation.
- Definition of done: baseline Sentry/PostHog instrumentation for key failures/events.
- Routes: core app routes.
- Tests required: smoke checks + event emission assertions where feasible.
- Manual checklist: trigger controlled errors and verify capture.
- Git checkpoint: checkpoint/m11-observability
- Exclusions: no new product features.

### Milestone 12: Orion Typed Completion
- Scope: typed command center reliability and UX polish.
- Definition of done: typed flows stable, no accidental navigation bugs.
- Routes: command center overlay usage across app.
- Tests required: keyboard and typed command regression suites.
- Manual checklist: execute core commands from dashboard and detail pages.
- Git checkpoint: checkpoint/m12-orion-typed
- Exclusions: voice migration.

### Milestone 13: Orion Voice Migration to OpenAI Realtime
- Scope: migrate voice stack when platform is stable.
- Definition of done: realtime voice path replaces browser recognition loops safely.
- Routes: global provider + Orion entry surfaces.
- Tests required: lifecycle, fallback, and failure handling tests.
- Manual checklist: wake, command, spoken response, recoverability.
- Git checkpoint: checkpoint/m13-orion-realtime
- Exclusions: unrelated module work.

## Target Platform Architecture Status

Frontend
- Next.js: implemented
- React: implemented
- Tailwind CSS: implemented

Backend
- Supabase: implemented
- PostgreSQL: implemented (via Supabase)
- Supabase Auth: implemented
- Supabase Storage: partially implemented (usage appears module-specific; needs explicit storage audit)

External services
- OpenAI: partially implemented (SDK dependency and Orion services present)
- OpenAI Realtime for Orion voice: not implemented
- Google Maps: not implemented in verified scope
- Stripe: not implemented in verified scope
- Vercel: partially implemented (deployment-target assumptions, no batch change)
- Sentry: not implemented in verified scope
- PostHog: not implemented in verified scope

Recommended integration milestone mapping
- OpenAI Realtime: Milestone 13
- Google Maps: Milestone 10 or post-beta integration sprint
- Stripe: Milestone 6 or dedicated financial hardening sprint
- Sentry/PostHog: Milestone 11
- Supabase Storage hardening: Milestone 10

## Known Blockers
1. Multiple dev servers were active in this workspace, reducing confidence in live runtime observations.
2. Dirty worktree is very large; unrelated edits increase regression risk for broad stabilization changes.
3. Request-loop risk pattern remains in operations/employee profile hooks and is not remediated in this batch by design.

### Resolved — Schedule render-fetch loop

- Owner: lib/scheduling/use-scheduling.ts
- Root cause: The scheduling service was recreated on every render, which recreated refresh and repeatedly retriggered the loading effect.
- Fix: The scheduling service is now memoized and shared by refresh and action callbacks.
- Automated verification: Scheduling loop regression test passed; typecheck and production build passed.
- Browser verification: Schedule remained stable after refresh, requests stopped increasing, and ERR_INSUFFICIENT_RESOURCES did not return.
- Status: RESOLVED

## Active Milestone
- Milestone 1: Platform Stability and Request-Loop Elimination.

## Deferred Items
- Orion typed-input bug remains deferred.
- Orion voice feature expansion deferred.
- OpenAI Realtime migration deferred.

## Checkpoint Policy
- Create one checkpoint branch/tag per milestone completion.
- Require green check + typecheck + build + targeted regression tests before checkpoint.
- Require owner browser acceptance for routes in milestone scope before checkpoint promotion.
- Never checkpoint with known unbounded request loop in scope routes.

## Next Recommended Task
- Implement Milestone 1 loop-risk fixes only:
  - convert service default-parameter factories to stable refs/memo in:
    - lib/operations/use-operations.ts
    - lib/employees/use-employee-profile.ts
  - add deterministic loop regression tests for these hooks.
  - verify bounded request traffic for /operations, /dispatch, /employees/[id] over 30s idle.
