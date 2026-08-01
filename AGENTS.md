<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# BangoOS Agent Guide

Start here, then read [.github/copilot-instructions.md](.github/copilot-instructions.md) before editing.

## Read Before Writing

- Application rules and completion requirements: [.github/copilot-instructions.md](.github/copilot-instructions.md)
- UI and visual constraints: [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)
- Public schema source of truth: [supabase/schema-public.sql](supabase/schema-public.sql)
- Generated database types: [types/database.types.ts](types/database.types.ts)

## Working Style

- Keep scope tight. Recent work in this repo is often phase-scoped; do only the requested slice and avoid adjacent redesigns.
- Reuse existing module patterns before creating new helpers, layouts, or Supabase access paths.
- Do not touch Supabase schema, RLS, migrations, or business logic unless the task explicitly requires it.
- In auto-allow workflows, make the smallest grounded change you can, then validate immediately.
- Preserve the existing UI unless the task explicitly asks for a redesign. When UI work is requested, follow [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) instead of inventing a new visual direction.

## Repo-Specific Pitfalls

- This is a multi-tenant app. Company-owned reads and writes must be authenticated and scoped by `company_id`.
- Use the existing Supabase helpers in `lib/supabase/`; do not create duplicate clients or auth flows.
- Do not guess table or column names. Verify against [supabase/schema-public.sql](supabase/schema-public.sql) and [types/database.types.ts](types/database.types.ts).
- App Router pages using `useSearchParams()` must render within `Suspense` to avoid prerender failures.
- The ESLint rule `react-hooks/set-state-in-effect` is enforced. Avoid synchronous state-setting inside effects.
- Shared UI primitives in `components/ui/` and existing module components should be extended before page-specific styling is added.
- On this Windows workspace, `rg` may be unavailable in terminal sessions. Use PowerShell file-search fallbacks when needed.

## Validation

- Primary validation path: `npm run check`
- Individual checks: `npm run lint`, `npm run build`
- For Supabase migration changes, validate with `npx supabase db push --linked --dry-run` before reporting completion.

## Response Expectations

- Summarize changed files and list exact manual test steps.
- Call out assumptions and unresolved issues explicitly.
- Do not claim validation you did not run.
