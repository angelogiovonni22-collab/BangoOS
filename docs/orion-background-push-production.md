# Orion Background Push — Production Activation

The application code, reminder persistence, push subscription flow, service worker, push dispatcher, and one-minute Supabase Cron scheduler are versioned in this repository. Production activation requires secrets to be stored in the hosting platforms; never commit them to Git.

## Required runtime values

### Vercel

- `ORION_VAPID_PUBLIC_KEY` — public VAPID key used by the browser subscription endpoint.

### Supabase Edge Function secrets

- `ORION_VAPID_PUBLIC_KEY`
- `ORION_VAPID_PRIVATE_KEY`
- `ORION_VAPID_SUBJECT` — e.g. `mailto:notifications@your-domain.com`
- `ORION_PUSH_DISPATCH_SECRET`

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied by the Supabase Edge Function runtime.

### Supabase Vault

Create these encrypted Vault entries after deploying the Edge Function:

- `orion_push_dispatch_url` = `https://<project-ref>.supabase.co/functions/v1/orion-push-dispatch`
- `orion_push_dispatch_secret` = the exact same value as `ORION_PUSH_DISPATCH_SECRET`

The scheduler migration reads these values at runtime. If either is absent, the scheduled database function safely returns without making a request.

## Deployment order

1. Generate one VAPID key pair. Keep the private key secret.
2. Set `ORION_VAPID_PUBLIC_KEY` in Vercel production environment.
3. Set the four Orion push secrets on the Supabase Edge Function project.
4. Push database migrations so `orion_push_subscriptions`, `orion_reminders`, and the cron scheduler exist.
5. Deploy `supabase/functions/orion-push-dispatch`.
6. Store `orion_push_dispatch_url` and `orion_push_dispatch_secret` in Supabase Vault.
7. Redeploy B.O.S. if Vercel did not automatically redeploy after the environment variable change.
8. On iPhone, install/open B.O.S. from the Home Screen icon, open Orion, tap **Enable Orion Notifications**, and accept the iOS notification permission prompt.
9. Create a reminder a few minutes in the future, fully close B.O.S., lock the iPhone, and verify the notification arrives and opens B.O.S. when tapped.

## Scheduler behavior

`20260815201000_orion_push_scheduler.sql` installs `pg_cron` and `pg_net`, creates `public.dispatch_due_orion_reminders()`, and schedules it once per minute as `orion-push-dispatch`. The HTTP request carries the dispatch secret in `x-orion-push-secret` and the Edge Function rejects requests that do not match its configured secret.

## Security rules

- Never commit `ORION_VAPID_PRIVATE_KEY`, `ORION_PUSH_DISPATCH_SECRET`, Supabase service-role keys, or any database password.
- The VAPID public key is intentionally safe to expose to the browser.
- Expired push subscriptions are deleted by the dispatcher when the push service returns HTTP 404 or 410.
- Reminder and push-subscription tables are protected by RLS and scoped to the authenticated user plus active company membership.
