# B.O.S. Recovery Drill Evidence — 2026-09-07

## Scope

This evidence records the non-destructive disaster-recovery validation performed against the BangoOS Production Supabase project and a separate restored recovery project. Production was never restored in place.

- Production project: `rhhctwyaomvsplevfbnx` (`BangoOS`)
- Restored recovery project: `eeyhqmlczgwiobvfvute`
- Restore source backup: `06 Sep 2026 13:08:24 UTC` (Supabase dashboard: COMPLETED)
- Restore initiated: `07 Sep 2026 02:13:38 UTC`
- Recovery project region: `us-west-2`
- Recovery project state at verification: `ACTIVE_HEALTHY`

## Recovery objectives observed

- Observed recovery-point age at restore initiation: approximately **13 hours 5 minutes**.
- Restore-to-verification elapsed time is bounded by the available evidence at **less than 2 hours 1 minute**; the database was healthy and parity checks were complete by approximately 04:14 UTC.
- The recovered environment remained isolated from the Production application.

## Database and auth parity

Representative row-count verification matched between Production and recovery:

| Dataset | Production | Recovery |
| --- | ---: | ---: |
| companies | 3 | 3 |
| projects | 1 | 1 |
| customers | 2 | 2 |
| estimates | 1 | 1 |
| invoices | 0 | 0 |
| auth users | 12 | 12 |
| Storage object metadata rows | 4 | 4 |
| Storage buckets | 8 | 8 |

Current post-restore migrations were rolled forward on the recovery project, including the account-deletion request queue migration added during commercial-launch hardening.

## Storage verification

Storage metadata matched Production exactly for all four recorded objects at the time of verification, including bucket, object path, recorded size, and MIME type:

- one PDF object in `blueprints`
- three image objects in `project-photos`

This validates restored Storage metadata and object inventory. **Private object byte retrieval was not independently verified in this tool session**, so byte-level restore verification remains a separate manual/provider check before the recovery gate is considered fully closed.

## Edge Function verification

`orion-push-dispatch` exists and is ACTIVE in both Production and recovery. The deployed source hash matched exactly:

`8c279a203fc86c8c6252a3aed0951f79a760d65687511e8edf4395a9927bff1f`

The function source contains explicit dispatch-secret validation before service-role or push-delivery logic. Recovery function source parity is therefore confirmed. Recovery runtime secrets and an authorized send-path were **not** exercised, intentionally avoiding outbound push delivery from the isolated recovery project.

## Known gaps / required approvals

The following are intentionally not completed by this evidence file:

1. Private Storage file **bytes** must be fetched/read from the restored project to confirm object-body recovery, not only metadata recovery.
2. Recovery Edge Function secret presence and a safe authorized runtime path require a controlled secret-aware test; no outbound push should be sent during the drill.
3. The restored recovery project must not be deleted until explicit cleanup approval is obtained because deletion is irreversible.
4. A second project named `BangoOS Recovery Drill` (`areldaufdjmhzlweltqc`) exists but does not contain the BangoOS schema and was not used as the successful restored environment. It should be reviewed for cleanup separately; no deletion was performed.

## Result

**Database/auth recovery: PASS**  
**Storage metadata recovery: PASS**  
**Edge Function source recovery: PASS**  
**Private Storage byte recovery: MANUAL GATE REMAINS**  
**Recovery secret/send-path validation: MANUAL GATE REMAINS**

No Production data was modified by the restore itself, no real customer workflow was exercised, and no recovery project was deleted during this drill.
