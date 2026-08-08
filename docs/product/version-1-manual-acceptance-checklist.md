# B.O.S. Version 1.0 Manual Acceptance Checklist

Date: 2026-08-04
Target: Version 1.0 manual acceptance testing
Scope: Major production workflows only, no feature expansion

## Audit Summary For Manual Test Readiness

- Critical blocker found: No
- Build and typecheck status: Passing
- Full test suite status: Passing
- Watch item: Middleware deprecation warning is present (middleware to proxy migration), but this does not block manual QA execution.
- Watch item: Route protection appears focused on selected modules. Permission tests below include direct URL access checks for all major modules.

## How To Use This Checklist

- Execute each workflow in order.
- Mark both pass/fail checkboxes for each item as you validate.
- Capture notes, screenshots, and browser console/network anomalies for failed items.

---

## Global Preconditions

- [ ] Valid test users available for at least two companies:
- [ ] Company A Owner or Admin
- [ ] Company A Standard Employee
- [ ] Company B Owner or Admin
- [ ] Test data seeded for Company A:
- [ ] At least 1 customer, 1 project, 1 estimate, 1 invoice, 1 daily report, 1 employee, 1 crew
- [ ] Optional empty-state test tenant with minimal records
- [ ] Browser desktop viewport and mobile viewport available
- [ ] Browser devtools available for console/network verification

---

## Module: Authentication And Session

### AUTH-01 Login Success

| Field | Details |
|---|---|
| Preconditions | Valid user credentials exist |
| Steps | 1. Open /login. 2. Enter valid credentials. 3. Submit. |
| Expected Result | User is authenticated and redirected to dashboard or next route; no uncaught errors. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### AUTH-02 Login Failure Feedback

| Field | Details |
|---|---|
| Preconditions | Invalid credentials available |
| Steps | 1. Open /login. 2. Enter invalid credentials. 3. Submit. |
| Expected Result | Friendly error is shown; form remains usable; no blank screen or crash. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### AUTH-03 Protected Route Redirect

| Field | Details |
|---|---|
| Preconditions | Logged out session |
| Steps | 1. Directly open /dashboard. 2. Directly open /projects. |
| Expected Result | Redirect to /login with next parameter; no data exposure. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### AUTH-04 Auth Route Redirect When Logged In

| Field | Details |
|---|---|
| Preconditions | Logged in session |
| Steps | 1. Open /login. 2. Open /signup. |
| Expected Result | Redirect to /dashboard; no auth page access while authenticated. |
| Pass / Fail | [ ] Pass  [ ] Fail |

---

## Module: App Shell And Navigation

### NAV-01 Sidebar Navigation Integrity

| Field | Details |
|---|---|
| Preconditions | Logged in session |
| Steps | 1. Open app shell. 2. Click each sidebar module entry. |
| Expected Result | Each route loads the expected module; active state highlights correctly. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### NAV-02 Mobile Sidebar Open Close And Scroll Lock

| Field | Details |
|---|---|
| Preconditions | Mobile viewport |
| Steps | 1. Open sidebar. 2. Scroll nav list. 3. Close via backdrop and close button. |
| Expected Result | Body scroll is locked when menu open; restored when closed; no overlap trapping. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### NAV-03 Keyboard Navigation And Focus Visibility

| Field | Details |
|---|---|
| Preconditions | Logged in session |
| Steps | 1. Use Tab and Shift+Tab through header, sidebar, and primary actions. |
| Expected Result | Focus indicator remains visible and logical; no keyboard trap. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### NAV-04 Command Overlay Shortcut

| Field | Details |
|---|---|
| Preconditions | Logged in session |
| Steps | 1. Press Ctrl+K from multiple modules. 2. Close overlay. |
| Expected Result | Overlay opens reliably and closes without UI corruption. |
| Pass / Fail | [ ] Pass  [ ] Fail |

---

## Module: Dashboard

### DASH-01 Dashboard Load State And Data Surface

| Field | Details |
|---|---|
| Preconditions | Logged in session with non-empty tenant |
| Steps | 1. Open /dashboard. 2. Hard refresh. |
| Expected Result | Loading skeleton appears first, then KPI and activity content renders. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### DASH-02 Dashboard Empty State Behavior

| Field | Details |
|---|---|
| Preconditions | Logged in session for empty tenant |
| Steps | 1. Open /dashboard. |
| Expected Result | Honest empty/low-data messaging appears, no fabricated business records. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### DASH-03 Dashboard Error Handling

| Field | Details |
|---|---|
| Preconditions | Temporary network interruption or API failure simulation |
| Steps | 1. Open /dashboard while offline or blocked request. |
| Expected Result | Friendly error state appears; page remains recoverable after retry/network restore. |
| Pass / Fail | [ ] Pass  [ ] Fail |

---

## Module: Customers

### CUST-01 Customer List Search And Filter

| Field | Details |
|---|---|
| Preconditions | At least 3 customers with varied status/type |
| Steps | 1. Open /customers. 2. Search by name/email/phone. 3. Apply status/type filters. |
| Expected Result | List updates correctly; clear empty result state when no match. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### CUST-02 Create Customer Workflow

| Field | Details |
|---|---|
| Preconditions | Create permission user |
| Steps | 1. Open /customers/new. 2. Submit valid data. |
| Expected Result | Record is created, success behavior is clear, and detail page/list reflects new customer. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### CUST-03 Customer Detail Workspace Tabs

| Field | Details |
|---|---|
| Preconditions | Existing customer with linked records |
| Steps | 1. Open /customers/{id}. 2. Validate Overview, Projects, Estimates, Invoices, Change Orders, Documents, Photos, Notes, Timeline tabs. |
| Expected Result | Real data or honest empty/error states in every tab; no placeholder-only content. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### CUST-04 Customer Timeline Integrity

| Field | Details |
|---|---|
| Preconditions | Customer with Orion events |
| Steps | 1. Open customer timeline tab. |
| Expected Result | Timeline entries are real and company-scoped; no duplicate fake entries. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### CUST-05 Customer Edit Workflow

| Field | Details |
|---|---|
| Preconditions | Existing customer |
| Steps | 1. Open /customers/{id}/edit. 2. Change values. 3. Save. |
| Expected Result | Changes persist and are visible on detail/list reload. |
| Pass / Fail | [ ] Pass  [ ] Fail |

---

## Module: Projects

### PROJ-01 Project List Load, Search, Filter

| Field | Details |
|---|---|
| Preconditions | Projects across multiple statuses |
| Steps | 1. Open /projects. 2. Search and apply filters. |
| Expected Result | Correct filtered output, loading skeleton, and empty state behavior. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### PROJ-02 Create Project Workflow

| Field | Details |
|---|---|
| Preconditions | Create permission user and valid customer |
| Steps | 1. Open /projects/new. 2. Submit valid project. |
| Expected Result | Project persists and is accessible via project detail route. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### PROJ-03 Project Workspace Tab Coverage

| Field | Details |
|---|---|
| Preconditions | Existing project |
| Steps | 1. Open /projects/{id}. 2. Validate Overview, Work, Financial, Resources, Documents, Timeline tabs. |
| Expected Result | All tabs render without crash; each has loading and empty/error behavior where relevant. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### PROJ-04 Phase And Task Panels

| Field | Details |
|---|---|
| Preconditions | Project with at least one phase and tasks |
| Steps | 1. Open project work area. 2. Select phase. 3. Review tasks, status, assignee, due date, priority, completion. |
| Expected Result | Real task data shown; honest empty state when no tasks in phase. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### PROJ-05 Plans And SiteCam Surfaces

| Field | Details |
|---|---|
| Preconditions | Project with and without files/photos |
| Steps | 1. Open plans-related workflow and sitecam workflow. 2. Validate file actions and preview behavior. |
| Expected Result | No fake preview success; unsupported/unavailable states are explicit and honest. |
| Pass / Fail | [ ] Pass  [ ] Fail |

---

## Module: Daily Reports

### DR-01 Daily Reports List And Filters

| Field | Details |
|---|---|
| Preconditions | At least one daily report exists |
| Steps | 1. Open /daily-reports. 2. Apply filters and search. |
| Expected Result | List updates correctly; empty state appears when no matches. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### DR-02 Create Daily Report

| Field | Details |
|---|---|
| Preconditions | Project available |
| Steps | 1. Open /daily-reports/new. 2. Complete required inputs. 3. Save. |
| Expected Result | Report persists and opens from list/detail route. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### DR-03 Edit Daily Report

| Field | Details |
|---|---|
| Preconditions | Existing report |
| Steps | 1. Open /daily-reports/{id}/edit. 2. Modify values. 3. Save. |
| Expected Result | Changes persist and render on detail reload. |
| Pass / Fail | [ ] Pass  [ ] Fail |

---

## Module: Estimates

### EST-01 Estimate List, Create, Detail, Edit

| Field | Details |
|---|---|
| Preconditions | At least one project and customer |
| Steps | 1. Open /estimates. 2. Create new estimate. 3. Open detail. 4. Edit and save. |
| Expected Result | End-to-end CRUD path works with clear validation and error states. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### EST-02 Estimate Workflow Actions

| Field | Details |
|---|---|
| Preconditions | Estimate in actionable status |
| Steps | 1. Trigger send/approve/decline/convert paths as available. |
| Expected Result | Status transitions are reflected and user feedback is clear. |
| Pass / Fail | [ ] Pass  [ ] Fail |

---

## Module: Invoices

### INV-01 Invoice List, Create, Detail, Edit

| Field | Details |
|---|---|
| Preconditions | At least one project/customer |
| Steps | 1. Open /invoices. 2. Create invoice. 3. Open detail and edit. |
| Expected Result | Persistence is correct; totals and balances render consistently. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### INV-02 Invoice Print View

| Field | Details |
|---|---|
| Preconditions | Existing invoice |
| Steps | 1. Open /invoices/{id}/print. |
| Expected Result | Print-safe rendering works and does not crash. |
| Pass / Fail | [ ] Pass  [ ] Fail |

---

## Module: Change Orders

### CO-01 Change Order Lifecycle

| Field | Details |
|---|---|
| Preconditions | Existing project |
| Steps | 1. Open /change-orders. 2. Create change order. 3. Open detail. 4. Edit and print. |
| Expected Result | Workflow is navigable and persistent with proper states. |
| Pass / Fail | [ ] Pass  [ ] Fail |

---

## Module: Workforce (Employees, Crews, Team)

### WF-01 Employee Directory And Filters

| Field | Details |
|---|---|
| Preconditions | At least two employees with different statuses |
| Steps | 1. Open /employees. 2. Filter by status/availability/crew/supervisor/project. |
| Expected Result | Filters are deterministic; empty states are accurate. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### WF-02 Employee Create And Profile

| Field | Details |
|---|---|
| Preconditions | Create permission user |
| Steps | 1. Open /employees/new. 2. Save employee. 3. Open /employees/{id}. 4. Edit profile. |
| Expected Result | Profile persists and grouped assignment/membership data renders safely. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### WF-03 Crew List, Create, Detail, Edit

| Field | Details |
|---|---|
| Preconditions | At least one employee available for assignment |
| Steps | 1. Open /crews. 2. Create crew. 3. Open detail. 4. Edit. |
| Expected Result | Crew workflow is persistent and company-scoped. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### WF-04 Team Workspace

| Field | Details |
|---|---|
| Preconditions | Logged in user |
| Steps | 1. Open /team and validate page behavior under normal and low-data conditions. |
| Expected Result | No crashes; clear messaging and accessible controls. |
| Pass / Fail | [ ] Pass  [ ] Fail |

---

## Module: Scheduling And Dispatch

### SCH-01 Schedule Workspace

| Field | Details |
|---|---|
| Preconditions | Scheduling data available |
| Steps | 1. Open /schedule. 2. Validate load, filters, and empty state. |
| Expected Result | Schedule route renders schedule-specific workspace without dispatch confusion. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### SCH-02 Dispatch Workspace

| Field | Details |
|---|---|
| Preconditions | Scheduling data available |
| Steps | 1. Open /dispatch. 2. Validate dispatch-specific cards and actions. |
| Expected Result | Dispatch route remains distinct from schedule route. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### SCH-03 Legacy Scheduling Redirects

| Field | Details |
|---|---|
| Preconditions | Logged in session |
| Steps | 1. Open /scheduling, /scheduling/dispatch, /scheduling/calendar, /scheduling/forecast directly. |
| Expected Result | Redirect behavior lands on the expected modern routes. |
| Pass / Fail | [ ] Pass  [ ] Fail |

---

## Module: Operations And Timeline

### OPS-01 Operations Overview Surface

| Field | Details |
|---|---|
| Preconditions | Logged in with operational data |
| Steps | 1. Open /operations. 2. Validate cards, status indicators, and actions. |
| Expected Result | Real operational data appears or honest partial/empty notices, no mock fixtures. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### OPS-02 Timeline Route Integrity

| Field | Details |
|---|---|
| Preconditions | Existing Orion events |
| Steps | 1. Open /timeline. 2. Filter by event category/date/entity if available. |
| Expected Result | Timeline entries are company-scoped, ordered, and navigable without duplication noise. |
| Pass / Fail | [ ] Pass  [ ] Fail |

---

## Module: Resource Catalogs

### RES-01 Equipment CRUD And Assignment Context

| Field | Details |
|---|---|
| Preconditions | Existing project and optional crew |
| Steps | 1. Open /equipment. 2. Create item. 3. Open detail/edit. |
| Expected Result | Equipment records persist; assignment/status displays correctly. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### RES-02 Materials CRUD

| Field | Details |
|---|---|
| Preconditions | Logged in session |
| Steps | 1. Open /materials. 2. Create, view, edit material. |
| Expected Result | Persistence and empty/error states behave correctly. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### RES-03 Vendors CRUD

| Field | Details |
|---|---|
| Preconditions | Logged in session |
| Steps | 1. Open /vendors. 2. Create, view, edit vendor. |
| Expected Result | Vendor data persists and list/detail states are stable. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### RES-04 Cost Codes, Labor Rates, Units Of Measure CRUD

| Field | Details |
|---|---|
| Preconditions | Logged in session |
| Steps | 1. Open each module: /cost-codes, /labor-rates, /units-of-measure. 2. Execute create/view/edit flow in each. |
| Expected Result | All catalog modules are operational with loading/empty/error validation. |
| Pass / Fail | [ ] Pass  [ ] Fail |

---

## Module: Settings And Memory Review

### SET-01 Settings Page Access And Save Behavior

| Field | Details |
|---|---|
| Preconditions | Logged in session |
| Steps | 1. Open /settings. 2. Validate page interactions and save/feedback controls. |
| Expected Result | Settings UI is accessible and stable; no silent failures. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### SET-02 Memory Review Route

| Field | Details |
|---|---|
| Preconditions | Logged in session |
| Steps | 1. Open /settings/memory-review. |
| Expected Result | Route loads without crash and presents clear state even when no records exist. |
| Pass / Fail | [ ] Pass  [ ] Fail |

---

## Module: Orion Interfaces

### ORION-01 Persistent Orion Sphere And Panel

| Field | Details |
|---|---|
| Preconditions | Logged in session |
| Steps | 1. Open any app route. 2. Drag sphere. 3. Open panel. 4. Minimize and restore. |
| Expected Result | Sphere remains draggable, accessible, and non-blocking; panel interactions are stable. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### ORION-02 Command Center Overlay

| Field | Details |
|---|---|
| Preconditions | Logged in session |
| Steps | 1. Open via Ctrl+K and UI button. 2. Close with Escape and explicit close action. |
| Expected Result | Overlay behavior is consistent, keyboard-accessible, and non-crashing. |
| Pass / Fail | [ ] Pass  [ ] Fail |

---

## Module: Cross-Cutting Reliability Checks

### REL-01 Global Error Boundary Recovery

| Field | Details |
|---|---|
| Preconditions | Ability to induce route-level runtime error in test environment |
| Steps | 1. Trigger a recoverable runtime error in app route. 2. Use Try Again action. |
| Expected Result | Error state renders and reset recovers route without full-session corruption. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### REL-02 Crash Handling Under Network Loss

| Field | Details |
|---|---|
| Preconditions | Browser can toggle offline mode |
| Steps | 1. Load key module pages while offline. 2. Restore network and retry. |
| Expected Result | Friendly error states appear; no white screen; retry path recovers. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### REL-03 Logging And Console Noise

| Field | Details |
|---|---|
| Preconditions | Browser devtools open |
| Steps | 1. Execute major workflows. 2. Watch console and network for uncaught exceptions or repeated failures. |
| Expected Result | No uncaught exceptions; expected handled logs only. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### REL-04 Permission Isolation Across Companies

| Field | Details |
|---|---|
| Preconditions | User from Company B and record IDs from Company A |
| Steps | 1. While logged in as Company B, open direct URLs for Company A records across customers/projects/employees/invoices/estimates/daily reports. |
| Expected Result | Access denied, not found, or empty state without data leakage. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### REL-05 Accessibility Spot Checks

| Field | Details |
|---|---|
| Preconditions | Keyboard-only and screen-reader checks available |
| Steps | 1. Validate tab order and focus ring on login, dashboard, list pages, form pages, modal/overlay pages. 2. Validate key controls with ARIA labels and headings. |
| Expected Result | Keyboard operation is complete; no focus traps; labels are announced meaningfully. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### REL-06 Mobile Layout Spot Checks

| Field | Details |
|---|---|
| Preconditions | Mobile viewport width around 375 px |
| Steps | 1. Validate login, dashboard, customers, projects, daily reports, operations, schedule, dispatch. |
| Expected Result | No clipped critical controls; scrolling works; side panels and dialogs are usable. |
| Pass / Fail | [ ] Pass  [ ] Fail |

### REL-07 User Feedback And Form Validation

| Field | Details |
|---|---|
| Preconditions | Create and edit forms available |
| Steps | 1. Submit invalid forms across modules. 2. Submit valid forms. |
| Expected Result | Required-field and validation messages are clear; submit buttons handle disabled/loading states; success behavior is explicit. |
| Pass / Fail | [ ] Pass  [ ] Fail |

---

## Sign-Off

- Tester Name:
- Date:
- Environment:
- Total Passed:
- Total Failed:
- Blocking Defects Filed:
- Go or No-Go Recommendation:
