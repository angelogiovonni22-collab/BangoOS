# Change order archive summary scope

Production reproduced Total2 / Pending Approval1 with Records=Active, but only
one approved row. Selecting the pending card produced an empty active directory;
the pending record appeared only after Records=Archived. This was an ambiguous
global summary attached to lifecycle-specific filter controls.

The directory now derives one archive-scoped collection for both cards and rows.
Records=Active excludes archived orders from status counts and approved value;
Archived includes only archived orders; All includes both. Status, search,
customer, project and date filters continue to narrow rows without narrowing
their navigation cards. Sorting, pagination and archive/restore handlers remain.
No records, statuses, amounts, permissions or database schema are changed.

Production acceptance steps:

1. Default Active: Total1, Pending0, Approved1, approved value $2,015.63; the real
   approved order remains visible. Pending card correctly returns an empty view.
2. Archived: Total1, Pending1, Approved0, approved value $0; pending card shows
   the retained pilot order with Restore available. Do not restore it.
3. All: Total2, Pending1, Approved1, approved value $2,015.63. Clear status to
   display both rows; narrow by search and confirm summary totals remain stable.
4. Repeat lifecycle scope in Spanish, then restore English and Active/default
   status. Review legibility and keyboard operation without editing records.

Local diff check and existing affected UI contract are the targeted checks;
local lint is unavailable without dependencies. No npm install or local build.
Final-head CI, actual Vercel Production identity and live acceptance evidence
are recorded in the verification checkpoint. The original replay/payment source
regressions are not manually repeated. Blueprint PDF rendering is a separate gate.
