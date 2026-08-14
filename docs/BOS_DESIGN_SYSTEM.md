# B.O.S. Design System v1.0

Status: Official design authority
Scope: Visual standards, shared architecture, and governance only
Non-goals: No business logic changes, no database changes, no routing/workflow changes, no page redesigns

## 0. Purpose and Authority

This document defines the permanent visual and interaction language for B.O.S. (Bango Operating System).

All current and future modules must inherit these standards through shared tokens and shared UI primitives.

When conflicts exist between local styling and this document, this document is authoritative.

## 1. Design Philosophy

B.O.S. is an enterprise operating platform for construction teams. Design decisions prioritize operational clarity over decorative minimalism.

Core principles:

1. Enterprise-first: every screen is decision support.
2. Built for field + office collaboration: scan quickly, decide quickly, act quickly.
3. Readability over minimalism: typography and contrast must never feel fragile.
4. Operational density with clarity: no wasted space, no visual noise.
5. Context-first hierarchy: every screen answers three questions in under 5 seconds.

Screen intent test:

1. Where am I?
2. What am I looking at?
3. What should I do next?

Workspace principle:

1. Every tab should behave like its own operations workspace.
2. Empty states must still provide direction and action.

Product language rule:

1. B.O.S. uses clear, professional, construction-first terminology.
2. Avoid aviation, military, space, gaming, and sci-fi metaphors in the core product UI.

## 2. Typography Standard

Global readability rule:

1. Any text displayed on white or light surfaces must meet the highest readability standard.
2. No washed-out gray for labels or values.
3. Entered field values must always be high contrast.

### 2.1 Type scale and classes

Current system utilities are defined in [app/globals.css](../app/globals.css).

| Role | Utility / Token | Size | Weight | Line Height | Contrast Guidance |
|---|---|---:|---:|---:|---|
| Page title | text-h1 | 2.25rem | 700 | 1.2 | Primary text only |
| Section header | text-h2 | 1.75rem | 700 | 1.3 | Primary text only |
| Modal title | text-h3 | 1.375rem | 700 | 1.35 | Primary text on light surface |
| Card title | text-card-title | 1.125rem | 700 | 1.35 | Primary text |
| Section title compact | text-section-title | 1.25rem | 700 | 1.35 | Primary text |
| KPI value | text-metric | 2.15rem | 700 | 1.1 | Highest contrast |
| Field label | text-body-secondary or text-caption | 0.9375rem or 0.8125rem | 600-700 | 1.45-1.6 | Secondary text, never muted-on-light |
| Field value | Input/Select value style | 1rem | 500 | control default | Primary text |
| Description | text-body-secondary | 0.9375rem | 500 | 1.6 | Secondary text with comfortable leading |
| Helper text | text-caption | 0.8125rem | 600 | 1.45 | Muted only when non-critical |
| Table header | text-table-header | 0.75rem | 700 | 1.2 | Secondary/primary contrast |
| Table value | table cell style | ~0.975rem | 500 | row default | Primary text |
| Empty-state title | component standard | ~1.7rem | 700 | tight | Primary text |
| Empty-state description | component standard | 1rem | 500 | 1.75 | Secondary text |
| Status text / badge | text-badge | 0.6875rem | 600+ | 1.2 | Must pass contrast on badge surface |

### 2.2 Contrast policy by surface

1. On white/light surfaces: use primary or strong secondary semantic text only.
2. On dark surfaces: use inverse semantic text tokens only.
3. Muted text is for helper context only, never for required labels or key values.

## 3. Color System

Current palette source is [app/globals.css](../app/globals.css).

### 3.1 Brand and semantic palette

1. Primary Navy: structural shell and deep surfaces.
2. Secondary Navy: elevated dark surfaces and layered modules.
3. Accent Blue: primary actions, active indicators, focus.
4. Success: completed, healthy, approved states.
5. Warning: pending, at-risk, blocked attention states.
6. Danger: destructive/error/cancelled states.
7. Neutral Gray: metadata and neutral UI states.
8. White Surface: cards, forms, table bodies in light mode.
9. Dark Surface: shell and command-center contexts in dark mode.

### 3.2 Usage intent

1. Color communicates system meaning first, branding second.
2. Avoid one-off decorative colors in production modules.
3. Prefer semantic status tokens over custom hex per component.

## 4. Light Mode and Dark Mode Architecture

B.O.S. must support both light and dark themes as a platform-level capability.

### 4.1 Current state audit

1. Strong token foundation exists in [app/globals.css](../app/globals.css).
2. Shared primitives already consume many CSS variables.
3. Significant hardcoded colors still exist in module-level components and some shared UI surfaces.
4. Several components currently assume fixed light backgrounds (bg-white) or fixed dark overlays.

### 4.2 Required semantic token architecture

Adopt semantic, mode-aware tokens (architecture only, not implementation in this milestone):

1. Background tokens:
   1. --ds-bg-app
   2. --ds-bg-shell
   3. --ds-bg-surface
   4. --ds-bg-surface-elevated
   5. --ds-bg-surface-muted
2. Text tokens:
   1. --ds-text-primary
   2. --ds-text-secondary
   3. --ds-text-muted
   4. --ds-text-inverse
3. Border tokens:
   1. --ds-border-subtle
   2. --ds-border-default
   3. --ds-border-strong
4. Semantic state tokens:
   1. --ds-accent
   2. --ds-success
   3. --ds-warning
   4. --ds-danger
   5. --ds-info
5. Effect tokens:
   1. --ds-shadow-sm
   2. --ds-shadow-md
   3. --ds-shadow-lg
   4. --ds-focus-ring

Theme binding model:

1. [data-theme="light"] defines light semantic values.
2. [data-theme="dark"] defines dark semantic values.
3. Components must consume semantic tokens only, never raw hex/hardcoded tailwind color values.

### 4.3 Light mode definition

1. Professional bright workspace.
2. White and light neutral surfaces.
3. Dark text with strong contrast.
4. Blue accent hierarchy and soft shadows.

### 4.4 Dark mode definition

1. Professional deep navy shell/workspace.
2. Layered surfaces for depth.
3. High readability contrast for text and controls.
4. Project Workspace visual language as reference baseline.

### 4.5 Theme switcher architecture (design only)

Placement:

1. Top navigation global control.

Modes:

1. Light
2. Dark
3. System (optional future extension)

Persistence architecture:

1. Save selection in user profile preference (server-backed) when authenticated.
2. Keep local fallback in localStorage for pre-auth and failover.
3. Apply data-theme at app root before hydration to avoid flash.

## 5. Card Standards

Card categories:

1. Workspace cards
2. Summary cards
3. KPI cards
4. Information cards
5. Status cards
6. Empty-state cards

Shared card baseline (source: [components/ui/card.tsx](../components/ui/card.tsx)):

1. Radius: var(--radius-card)
2. Border: semantic subtle/default border token
3. Shadow: semantic medium/large token by variant
4. Padding: tokenized via var(--space-card-padding)
5. Typography: card title utility + body utilities
6. Actions: button variants from shared button primitive

Rules:

1. Do not custom-style card chrome per page unless design review approves a variant token.
2. Status/chips inside cards should use Badge/StatusBadge semantics.

## 6. Empty State Standards

Required elements:

1. Icon
2. Title
3. Description
4. Primary action
5. Optional illustration

Behavior rules:

1. Must educate and direct users to next action.
2. Must avoid excessive dead space.
3. Must preserve accessibility and contrast on all themes.

Primary implementation primitives:

1. [components/ui/empty-state.tsx](../components/ui/empty-state.tsx)
2. [components/ui/error-state.tsx](../components/ui/error-state.tsx)
3. [components/ui/permission-state.tsx](../components/ui/permission-state.tsx)

## 7. Form Standards

Form experience principles:

1. Prefer completion within one laptop viewport when practical.
2. Group related fields into clear sections.
3. Use two-column field layout where comprehension improves.
4. Require only necessary fields.
5. Keep submission actions visually dominant.

Readability rules:

1. Labels must be at least semibold and high contrast.
2. Entered values must be primary text contrast.
3. Placeholder may be muted but never confused with entered values.
4. Validation copy must be actionable and readable.

Primary primitives:

1. [components/ui/input.tsx](../components/ui/input.tsx)
2. [components/ui/select.tsx](../components/ui/select.tsx)
3. [components/ui/search-input.tsx](../components/ui/search-input.tsx)
4. [components/ui/filter-toolbar.tsx](../components/ui/filter-toolbar.tsx)

## 8. Table Standards

Table requirements:

1. Clear header hierarchy
2. Comfortable row scan rhythm
3. Strong value readability
4. Distinct hover/selection states
5. Action controls aligned and predictable
6. Status badges semantically mapped

Current shared foundation:

1. [components/ui/enterprise-table.tsx](../components/ui/enterprise-table.tsx)
2. [components/ui/table-container.tsx](../components/ui/table-container.tsx)

Standards:

1. Headers use table-header typography utility.
2. Values use medium-weight readable text.
3. Row actions should avoid icon-only ambiguity unless tooltips exist.

## 9. Modal Standards

Dialog standards (architecture):

1. Max width: context-dependent, default large dialog width with overrides.
2. Max height: viewport constrained; internal scrolling allowed.
3. Content: grouped sections with clear headers.
4. Footer: reserved action zone; primary action right-aligned.
5. Keyboard: Escape close when allowed.
6. Focus trap and body scroll lock required.

Shared primitives:

1. [components/ui/dialog.tsx](../components/ui/dialog.tsx)
2. [components/ui/drawer.tsx](../components/ui/drawer.tsx)
3. [components/ui/bottom-sheet.tsx](../components/ui/bottom-sheet.tsx)
4. [components/ui/modal-header.tsx](../components/ui/modal-header.tsx)
5. [components/ui/modal-footer.tsx](../components/ui/modal-footer.tsx)

## 10. Responsive Standards

Desktop:

1. Multi-panel command-center layouts acceptable.
2. Dense operational information with clear hierarchy.

Tablet:

1. Secondary panels stack below primary work area.
2. Preserve action visibility and readability.

Mobile:

1. Single-column priority flow.
2. Bottom sheets preferred for transient tasks.
3. No horizontal scroll in production workflows.

Applies to cards, tables, forms, KPI blocks, and navigation behavior.

## 11. Iconography Standards

1. Icon sizes:
   1. 14px for inline/supporting iconography
   2. 16px for default control iconography
   3. 20-24px for KPI/feature identifiers
2. Spacing:
   1. Maintain 8px minimum gap with labels in controls.
3. Placement:
   1. Left-aligned for action primaries unless established pattern differs.
4. Status icons:
   1. Must align with semantic status color system.

## 12. Status Badge Standards

Canonical states:

1. Lead
2. Active
3. Completed
4. Pending
5. Archived
6. Cancelled
7. Warning
8. Success

Badge primitive:

1. [components/ui/badge.tsx](../components/ui/badge.tsx)
2. [components/ui/status-badge.tsx](../components/ui/status-badge.tsx)
3. [lib/design-system/tokens.ts](../lib/design-system/tokens.ts)

Rules:

1. Use semantic tone mapping, not custom ad-hoc badge colors.
2. Typography: uppercase not required globally, but consistency is required per context.
3. Shape: pill/rounded badge token.

## 13. Page Structure Standard

Recommended hierarchy for module pages:

1. Page Header
2. Hero (optional)
3. KPI Row (optional)
4. Tabs (optional)
5. Primary Workspace
6. Supporting Panels
7. Timeline/History

Future modules should inherit this structure whenever appropriate for operational scanning.

## 14. Accessibility Standard

1. High contrast text and controls in all themes.
2. Keyboard navigation for interactive elements.
3. Visible focus rings on all actionable controls.
4. Touch targets meet practical mobile minimums.
5. Readable typography at all breakpoints.
6. ARIA consistency for dialogs, menus, tables, and state announcements.

## 15. Future Modules Inheritance

Modules that must inherit this system:

1. CRM
2. Projects
3. Subcontractors
4. Customers
5. Employees
6. Equipment
7. Scheduling
8. Invoices
9. Financials
10. Materials
11. Documents
12. RFIs
13. Change Orders

Inheritance requirements:

1. Consume shared primitives first.
2. Extend via approved variants/tokens, not local one-off styling.
3. Preserve the global page hierarchy model unless a workflow exception is approved.

## 16. Shared Component Audit

Audit basis:

1. Shared UI exports in [components/ui/index.ts](../components/ui/index.ts)
2. Token foundations in [app/globals.css](../app/globals.css)
3. Design token helper map in [lib/design-system/tokens.ts](../lib/design-system/tokens.ts)
4. Representative workspace components in [components/projects/workspace](../components/projects/workspace)

### 16.1 Already compliant or near-compliant

1. [components/ui/card.tsx](../components/ui/card.tsx)
2. [components/ui/input.tsx](../components/ui/input.tsx)
3. [components/ui/select.tsx](../components/ui/select.tsx)
4. [components/ui/enterprise-table.tsx](../components/ui/enterprise-table.tsx)
5. [components/ui/summary-card.tsx](../components/ui/summary-card.tsx)
6. [components/ui/section-header.tsx](../components/ui/section-header.tsx)
7. [components/ui/page-header.tsx](../components/ui/page-header.tsx)
8. [components/ui/status-badge.tsx](../components/ui/status-badge.tsx)
9. [components/ui/badge.tsx](../components/ui/badge.tsx)
10. [lib/design-system/tokens.ts](../lib/design-system/tokens.ts)

### 16.2 Needs refinement to fully align with token-only theming

1. [components/ui/profile-menu.tsx](../components/ui/profile-menu.tsx)
2. [components/ui/language-selector.tsx](../components/ui/language-selector.tsx)
3. [components/ui/overlay-backdrop.tsx](../components/ui/overlay-backdrop.tsx)
4. [components/ui/button.tsx](../components/ui/button.tsx) (hardcoded gradient and rgba values)
5. [components/ui/dialog.tsx](../components/ui/dialog.tsx) (fixed bg-white in panel)
6. [components/ui/drawer.tsx](../components/ui/drawer.tsx) (fixed bg-white in panel)
7. [components/ui/bottom-sheet.tsx](../components/ui/bottom-sheet.tsx) (fixed bg-white and shadow rgba)
8. [components/ui/modal-header.tsx](../components/ui/modal-header.tsx) (hardcoded slate text)

### 16.3 Shared architecture hotspots outside core ui to align later

1. Extensive hardcoded hex usage in [components/projects/workspace](../components/projects/workspace)
2. Fixed slate palettes in several app-specific panels and overlays
3. Custom gradients and one-off status color values in command-center surfaces

Conclusion:

1. Shared foundation is strong.
2. The largest gap is not missing primitives; it is inconsistent token consumption in module-level implementations.

## 17. Design Token Strategy and Governance

### 17.1 Token layering strategy

Adopt a four-layer token model:

1. Primitive tokens: raw scales (spacing, radius, palette).
2. Semantic tokens: purpose-driven aliases (surface/text/border/state).
3. Component tokens: per-primitive contract values (button, card, modal, table).
4. Context tokens: optional module overrides for approved branded environments.

### 17.2 Enforcement architecture

1. Lint rule policy:
   1. Disallow hardcoded hex and raw tailwind color classes in shared and feature components (allow-list exceptions for labs/prototypes).
2. PR checklist gate:
   1. Requires semantic token usage.
   2. Requires typography utility usage.
   3. Requires theme behavior verification (light + dark).
3. Story/test governance:
   1. Visual snapshot checks for core components in both themes.
   2. Accessibility checks for contrast and focus visibility.
4. Variant governance:
   1. New visual patterns must be added as tokenized variants, not local per-page CSS.

### 17.3 Migration recommendation (future work, not in this milestone)

1. Phase 1: Normalize shared UI stragglers (profile menu, language selector, overlays, modal surfaces).
2. Phase 2: Replace hardcoded workspace hex colors with semantic tokens.
3. Phase 3: Introduce data-theme light/dark maps and switcher persistence.
4. Phase 4: Add automated token compliance checks in CI.

## 18. Shared UI Audit Summary

Current posture:

1. Shared primitives mostly token-driven and reusable.
2. Typography utilities now provide strong baseline hierarchy.
3. Remaining inconsistency is caused by hardcoded colors and local style islands.

Priority risks:

1. Theme scalability risk: hardcoded light/dark assumptions in module components.
2. Brand drift risk: local gradients and custom status colors.
3. Accessibility risk: inconsistent contrast on non-tokenized surfaces.

## 19. Enforcement Recommendations for Future Development

Mandatory rules for all new work:

1. Use shared ui primitive first; extend with approved variant second.
2. Use semantic tokens only for color, borders, text, and shadows.
3. Use typography utility classes for hierarchy and readability.
4. Validate both light and dark theme behavior before merge.
5. Do not introduce one-off hex or tailwind color classes in production modules.
6. Any exception requires documented design review rationale.

Definition of done for UI work:

1. Token-compliant
2. Typography-compliant
3. Contrast-compliant
4. Responsive-compliant
5. Keyboard/focus-compliant
6. Light/dark-compatible

---

This document is the official B.O.S. Design System v1.0 authority and should be referenced by all future design and frontend implementation work.
