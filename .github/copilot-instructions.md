# BangoOS Development Instructions

## Project Overview

BangoOS is a multi-tenant construction management SaaS application.

Technology stack:

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase Authentication
- Supabase PostgreSQL
- GitHub

## Core Development Rules

- Inspect existing project patterns before writing code.
- Reuse existing components, helpers, and conventions.
- Do not duplicate authentication or Supabase client logic.
- Do not guess database table names or database column names.
- Do not modify unrelated files.
- Preserve the existing UI unless a redesign is explicitly requested.
- Use TypeScript and provide explicit types where helpful.
- Never expose Supabase service-role keys or other secrets in client-side code.
- Never hardcode authenticated user IDs or company IDs.
- All company-owned records must be scoped by company_id.
- Authenticate the current user before loading or changing company-owned data.
- Use the existing Supabase client helpers in the lib/supabase directory.
- Handle loading, empty, success, and error states.
- Show friendly user-facing error messages.
- Keep components readable and avoid unnecessary duplication.

## Database Rules

- Confirm the real Supabase schema before using a table or column.
- Do not insert values into database-generated columns unless required.
- Respect nullable and required database fields.
- Scope select, insert, update, and delete operations to the authenticated company.
- Do not weaken Row Level Security policies to fix application errors.

## Next.js Rules

- Follow the existing App Router structure.
- Use client components only when browser state, events, or client-side Supabase access requires them.
- Use Next.js Link for internal navigation when appropriate.
- Keep route paths consistent with the existing application.
- Do not create duplicate layouts or Supabase clients.

## UI Rules

Every data-driven page should include:

- Loading state
- Empty state
- Friendly error state
- Responsive layout
- Clear disabled state during form submission

Forms should include:

- Required-field validation
- Friendly validation messages
- Disabled submit button while saving
- Protection against duplicate submissions
- Clear success behavior after saving

## Completion Requirements

Before reporting a coding task as complete:

1. Review the files changed.
2. Run npm run lint if the script exists.
3. Run npm run build if practical.
4. Fix errors introduced by the task.
5. Do not hide existing unrelated errors.
6. Summarize the files changed.
7. Provide exact manual testing steps.
8. Clearly state any assumptions or unresolved issues.

After creating the file:

1. Confirm the exact file path.
2. Confirm that no other files were changed.
3. Do not run npm install.
4. Do not run the build yet.
