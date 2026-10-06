# Purchasing cost recalculation actor — 2026-10-06

The operations-manager production workflow failed at approval when a different user created the cost code. Cost recalculation retained the previous updated_by and the existing actor RLS rejected the update. Project managers passed because their limited-cost trigger stamped the actor, while general financial roles skip that trigger.

The shared invoker cost calculator now stamps updated_by=auth.uid() and updated_at=now() alongside its existing totals. Calculations, role checks, locks, RLS and grants retain their existing behavior.

Validation: PGlite fixture now models actual cost-code actor WITH CHECK, seeds a different actor, reproduces failed approval/unchanged draft, applies the fix and passes approval→issue→receive→allocate with the authenticated actor. Production authenticated operations-manager and project-manager owner-seeded supplier-plan/cost-code workflows both passed inside rollback. Post-test original administrator role/empty overrides and archived/not-tracked/zero stock restored, temporary codes/orders absent. Targeted script lint passed; latest full lint 0 errors/27 existing warnings. App source unchanged, prior successful app build/77 primary contracts apply. Required linked CLI dry-run attempted and blocked by missing linkage. Advisors unchanged (3 INFO, pg_net warning, 1 anonymous/42 authenticated existing security-definer warnings).

Additional production denial checks passed for estimator, foreman, employee, subcontractor and customer RPC/direct order approval. Combined with PR784 checks, superintendent/office/accountant and revoked project manager are denied; default project manager and operations manager workflows pass. These are actual database role/claims tests, not fresh browser login sessions or a complete mutation matrix.

Applied SQL MD5 0f52126addcc1c23cca4993ceaae5f4d; connector version20261006223831 aligned to CLI-generated20261006223715 with exact name/hash guard and no SQL replay. Receipt correction/reversal, true concurrent sessions, retention/deletion, additional grants and remaining BOS acceptance register remain open.
