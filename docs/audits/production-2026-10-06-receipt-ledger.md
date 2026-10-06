# Receipt ledger integrity verification — 2026-10-06

Overall BOS completion remains unestablished. This repair follows merged/deployed PR781 (merge3bb462950da58e4940c4138939ba3777aadc10dd; Vercel https://vercel.com/bango-os/bango-os/CvaA8S8rdUz7wiNziJAPuw8pterp).

Authenticated Production rollback reproduced an issued order line directly changed to received0.500 with stock0 and no receipt history. The reproduction retained no test record.

The repair makes receipt insertion the atomic inventory event. New receipt history records the order line, received/damaged/backordered deltas, actual stock effect and before/after line counters. Invoker triggers prepare authenticated actor records, lock parent/line/material, apply line progress, stock and cost reconciliation, and reject direct counter edits lacking that ledger event. Receipt quantities/effects/actors and receipt deletion are protected; notes remain editable. Only unused draft orders/lines may be deleted. The existing retry-safe fulfillment RPC inserts the event and delegates its business writes to the triggers, preventing double receipt stock increments.

Legacy receipt headers retain NULL line/quantity/effect history. No guessed history was backfilled. Receipt reduction/correction remains fail-closed pending a reconciled reversal workflow; this repair does not claim that workflow exists. Financial-history retention is intentional; the separate authorized deletion/retention process remains an open acceptance item.

## Validation

- Actual PostgreSQL/PGlite suite passed direct receipt insert, denied direct counter changes, forged-effect/actor protection, ledger immutability, notes, deletion boundaries, unused-draft cascade deletion, injected late cost failure rollback, tracked/untracked effects and stable retries.
- The first Production rollback test caught an optional-cost-code regression absent from the initial cost-coded fixture. A separate CLI-generated corrective migration preserves already-applied migration bytes and skips cost recalculation for a NULL code. The fixture now includes that exact no-code receipt case and passed again.
- Production authenticated owner BEGIN/DO/ROLLBACK subsequently passed direct-write/deletion rejection, stock overflow rollback, optional-cost-code receipt, replay, direct receipt insert with forged effect/actors, receive/allocate completion. Postrollback material archived/not-tracked/stock0, test orders0, new ledger receipts0 and retained legacy headers2 verified before the visual test.
- Fresh lint passed0errors/27existingwarnings. All77 primary contract files listed by package precheck/check passed using the official tsx Node import loader; tsx CLI IPC could not listen in this environment. This is not a claim that the literal npm-run-check command passed. The successful application build earlier this continuation remains applicable: this repair changes only SQL, fixtures and documentation.
- Linked CLI push dry-run attempted with telemetry disabled and skip-vault; ProjectRefNotLinkedError. Not counted as passed.
- Security advisors unchanged:3internal RLS INFO, pg_netWARN,1anon/42authenticated existing security-definer WARN. New functions are invoker, fixed search_pathpg_catalog, direct execute revoked; no table RLS or grants broadened.
- The fixture's seven purchasing role authorization branches passed. Production policy review exposed an existing difference: project_manager/superintendent are allowed procurement writes but excluded from material/cost-code UPDATE. Those actual-role inventory/cost paths remain an explicit verification/repair item; the simplified fixture is not full Production role acceptance.

## Migration history

Exact SQL MD5 verified before narrow metadata alignment. No schema/business data reexecuted.

| Name | Connector timestamp | CLI repository version | MD5 |
| --- | --- | --- | --- |
| audit_receipt_ledger_integrity | 20261006220739 | 20261006220425 | 22657aff0e6d6bfd70f394c46a6deb02 |
| audit_receipt_optional_cost_code | 20261006220912 | 20261006220836 | 06f0edf6b24d59bb6bde44264b4e9bc7 |

Live visual owner workflow passed: PO-20261006-7c9f011b4c77 created/approved/issued/received0.125/allocated0.125; one ledger receipt before[0,0,0] after[0.125,0,0], inventory effect0.125, fully_received, total0 and stock0. A separate synthetic order1481ce55-01eb-469a-98d3-ab3372a42754 received0.200 once; a second attempt was rejected, and allocation0.200 returned stock0. Both retained closed histories have zero cost. Two distinct backend sessions were observed, but their transaction timestamps did not overlap; this is duplicate-attempt evidence, not true concurrency acceptance. Final material cleanup to archived/not-tracked/stock0 verified visually and in Production; final source review/merge/deployment follow. Remaining purchasing: reconciled receipt reversals/corrections, broad history boundaries, real concurrent sessions and actual role-policy matrix. Then resume the corrected14-area BOS completion register without future scope additions.
