# Record attachment parent authorization

Production investigation confirmed that the existing employee, customer and two
subcontractor contexts could select synthetic invoice attachment metadata while
the parent invoice was hidden by RLS and `invoices.view=false`. The fixture was
created and rolled back in one transaction. No private file content was accessed.

The new migration keeps the existing company policies and adds restrictive parent
read/manage guards. Invoker helpers query the actual parent under its existing RLS
and check the corresponding manage permission for writes. Metadata paths must
match the company, entity kind and record ID. Private Storage policies require the
same parent access; malformed paths and parent substitution fail closed.

Writers retain SELECT access to valid writable paths before metadata exists, so
upload RETURNING and cleanup after a failed metadata insert can work. Existing
readers still require linked, visible metadata. No permissive UPDATE policy is
added; the application uses `upsert:false`. No new SECURITY DEFINER function,
anonymous RPC grant, public bucket or parent policy change is introduced.

## Validation

`supabase/tests/record-attachment-parent-access.sql` is an actual-schema SQL
regression, run together with the migration inside one BEGIN/ROLLBACK. It tests
the seven existing active membership contexts (six role names), metadata invoice
SELECT/INSERT/UPDATE/DELETE, file-path read/write predicates, owner positive
controls for all four parent types, a separate existing foreign company,
malformed paths, path/parent substitution, a real accountant's customer read-only
permission, a nonmember and helper invoker/anonymous grant restrictions. No
memberships, profiles or permission overrides are modified. All metadata probes
roll back, including successful write controls.

These are PostgreSQL role/claim and policy-predicate checks. They do not establish
fresh login sessions, forged-token rejection, signed-URL expiry, file transfer,
Storage API upload/delete/overwrite or a complete multi-role browser matrix.
Those remain acceptance gates requiring actual authenticated test sessions and
synthetic files. Storage metadata must not be inserted/deleted directly with SQL.

Local lint was attempted; dependencies are absent (`eslint: not found`). No
`npm install` was run. Linked CLI migration dry-run was attempted and reported
`ProjectRefNotLinkedError`; the authenticated production migration API is the
available deployment route. Final-head CI and post-install verification are
recorded separately in the verification checkpoint. The original database
replay checks and thirteen source regressions were not manually repeated.
