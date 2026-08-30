# B.O.S. Commercial Launch Operations Runbook

## Service ownership and escalation

| Severity | Definition | Response target | First action |
| --- | --- | --- | --- |
| SEV-1 | Production unavailable, tenant isolation risk, data loss, or financial integrity risk | Acknowledge within 15 minutes | Freeze deployments and preserve evidence |
| SEV-2 | Major workflow unavailable with no reasonable workaround | Acknowledge within 1 hour | Identify affected deployment and dependency |
| SEV-3 | Degraded or isolated workflow with a workaround | Review next business day | Record reproduction and affected tenant |

The product owner is the incident commander until responsibility is delegated. Never inspect or change a real customer's data without explicit authorization. Never restore Production in place as a diagnostic step.

## Detection

- `GET /api/health` checks the deployed application, Production database, and Supabase Storage without exposing credentials or tenant data.
- `.github/workflows/production-smoke.yml` runs hourly and can be dispatched manually. A failure appears in GitHub Actions and covers dependency health, anonymous entry routing, and removal of the developer diagnostic.
- `instrumentation.ts` records sanitized `bos.request.error` events in Vercel runtime logs. It excludes request bodies, query values, user identifiers, and error messages.
- A degraded health check records `bos.health.degraded` with deployment and dependency status.

## Incident workflow

1. Record the first observed time, affected route/workflow, deployment SHA, and whether the issue affects one or multiple tenants.
2. Check the Production Smoke workflow, Vercel runtime logs, Vercel deployment state, Supabase project health, and Supabase advisors.
3. Classify the incident. If tenant isolation, payment integrity, or data loss may be involved, treat it as SEV-1.
4. Prefer a forward fix. Roll back only to a previously Production-verified deployment and verify schema compatibility first.
5. Run the read-only smoke checks after mitigation. Do not use real customer writes as a smoke test.
6. Record cause, impact, evidence, mitigation, and preventive follow-up.

## Backup and recovery

Production database backups are managed in Supabase. Before commercial launch, the dashboard must show a recent successful scheduled backup or an active PITR recovery window.

Safe recovery drill:

1. Use Supabase **Restore to a new project** from a recent physical backup. Do not restore over Production for a drill.
2. Treat creation of the recovery project as financially consequential and obtain approval first.
3. Keep the restored project isolated: no Production webhooks, outbound email, Stripe actions, scheduled jobs, or customer access.
4. Verify schema migration history, tenant counts, representative row counts, auth configuration, and required Storage objects.
5. Record recovery point objective, recovery time, missing objects/configuration, and cleanup approval.
6. Delete the recovery project only after approval because deletion is irreversible.

Production in-place restore is reserved for an approved incident response. Supabase documents that the project is inaccessible during restore. Storage objects, secrets, external provider configuration, and webhook settings require separate recovery verification.

## Release and rollback gate

- CI, dependency audit, UI audit, and Vercel deployment checks are green.
- Required Supabase migrations are applied and verified.
- `/api/health` is healthy in Production.
- Anonymous root routing and authenticated owner routing work in the actual Production application.
- Production Smoke is green after deployment.
- A rollback candidate and schema-compatibility decision are documented.
- Safari confirmation remains a separate manual browser gate where applicable.

## Support intake requirements

Every support issue must capture tenant/company, reporter, route, timestamp with timezone, browser/device, steps, expected/actual behavior, and whether a real customer or financial workflow is affected. Credentials, payment data, contract tokens, and customer documents must never be pasted into tickets.
