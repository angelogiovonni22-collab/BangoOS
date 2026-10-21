# Active crew eligibility

An archived pilot crew remained in the “ready for deployment” count and exposed booking controls. Active availability and assigned summary counts now require active crew status; all-status and archived history views retain the records. Inactive crew rows omit the availability badge. Profile assignment controls are disabled with an explanation. Schedule options retain disabled inactive crew identities so historical edits keep their selected crew. Operations equipment selectors offer active crews.

The database trigger rejects new, rescheduled or reactivated active-status crew bookings for inactive/archived crews, including direct table writes and atomic RPC calls. It preserves cancellation, terminal history edits, unchanged booking details and saved-request replay. It runs as invoker with existing company RLS, empty search path and no direct RPC execution grants. A shared crew-row lock serializes the eligibility check against a concurrent crew status update; no external work runs while that lock is held. This does not retroactively cancel existing assignments when a crew is archived, nor change employee or project eligibility rules.

Validation before promotion:

1. Run `lib/workforce/crew-availability.test.ts`: six crews across active/inactive/archived and free/booked states must report two active, one available, one assigned while retaining all records and archived profile details.
2. Apply the migration plus `supabase/tests/active-crew-booking.sql` inside one rollback-only transaction. Verify RPC/direct-write rejection leaves no schedule/compensation rows, active positive control, replay, note edits, cancellation/history edits and blocked reactivation/rescheduling. Independently verify rollback.
3. Pass final-head CI and compare security advisors before/after applying the reviewed migration. Do not weaken RLS or public execution controls.
4. On actual Production, verify the labelled archived crew remains in history, is absent from the Available quick filter and equipment selector, and has a disabled profile Assign action. Verify inactive options are disabled in new assignments and still selected in retained cancelled history. Check English/Spanish explanation and keyboard behavior.
5. Keep pilot forecast/actual/AR at zero, five cancelled histories and immutable purchasing reversals intact. Do not reactivate the pilot, perform payroll, send customer messages or move funds for acceptance.

Actual iPhone/Safari, complete role/write/storage entitlements, crew membership changes, retirement of existing active bookings, and broader payroll/provider acceptance remain separate gates. A row-lock implementation is not a claim that two independent archive/create sessions were tested.
