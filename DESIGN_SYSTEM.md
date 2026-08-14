# BangoOS Design System

## Core Rule

- Dark navigation, light workspace.
- Sidebar and selected navigation surfaces may stay dark navy.
- Main content, KPI cards, filters, forms, charts, and tables must stay on light surfaces.
- Avoid near-black backgrounds in normal workspace content.

## Typography

- Headings are dark, bold, and tightly tracked for clear hierarchy.
- Section titles use semibold weight and slightly smaller sizing.
- Body copy uses medium-gray text for readability.
- Helper and placeholder text stay subtle and never compete with primary content.
- Metrics use high-contrast bold numerals.

## Colors

- Primary Blue: core actions and navigation.
- Success Green: approved, active, completed, positive states.
- Warning Amber: pending, delayed, attention needed.
- Danger Red: destructive, cancelled, error states.
- Analytics Purple: analytical emphasis and insight surfaces.
- Information Slate: neutral metadata and system context.

Semantic colors must communicate meaning. Avoid decorative color usage.

## Spacing

- Use compact enterprise spacing between page sections.
- Align filters, KPI rows, tables, and forms to the same grid rhythm.
- Keep card and panel padding comfortable but efficient.

## Cards

- Use the shared card system for all content surfaces.
- Cards should use white backgrounds, subtle borders, rounded corners, and soft elevation.
- Hover elevation should be restrained and consistent.
- Dark card variants are reserved for navigation or special-purpose promotional surfaces.

## Buttons

- Primary: solid blue.
- Secondary: white surface with border.
- Outline: minimal transparent surface.
- Keep sizing and disabled states consistent across the app.

## Forms

- Use shared input and select styles.
- Labels should be prominent and inputs should have clear focus states.
- Validation messages must be readable and actionable.
- Keep submission states disabled while saving.

## Tables

- Tables should live inside a shared enterprise container.
- Use strong dark headers, slightly tinted header rows, comfortable row spacing, and clear hover states.
- Search, filters, actions, and pagination should feel like one toolbar.

## Status Badges

- Use the shared badge tone system for workflow states.
- Draft, submitted, approved, delayed, active, completed, pending, reviewed, archived, and cancelled must remain consistent.

## Icons

- Use icons consistently across modules for scanning and recognition.
- Keep icon containers circular or rounded and visually balanced with nearby text.

## Elevation

- Keep elevation subtle and purposeful.
- Reserve stronger shadow for important surfaces such as shell panels or highlighted cards.
- Avoid flashy motion or large transform effects.

## Accessibility

- Preserve visible focus states.
- Maintain sufficient contrast for text, badges, and controls.
- Never use low-contrast light text on light surfaces.
- Ensure responsive layouts collapse cleanly on tablet and mobile.
- Keep loading, empty, and error states readable.

## Component Usage

- PageHeader: every module top section.
- SummaryCard and MetricCard: KPI surfaces.
- TableContainer: directory and reporting tables.
- EmptyState and ErrorState: fallback content.
- StatusBadge and Badge: workflow/status indicators.
- MetricTrend: KPI comparisons and trend context.

## Future Guidelines

- Extend the shared primitives before adding page-specific styling.
- Keep new surfaces inside the established color and elevation system.
- Preserve routing and application behavior when iterating on visuals.
- Approved module mockups are canonical visual specifications; implementation must be compared side-by-side with the approved reference image before approval.