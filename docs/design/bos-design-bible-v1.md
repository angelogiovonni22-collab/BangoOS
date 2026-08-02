# B.O.S. Design Bible v1.0

Version: 1.0
Status: Canonical visual and interaction specification
Scope: Documentation-only policy for future implementation
Applies to: Web app, mobile app planning, Orion interfaces, marketing references, and future B.O.S. screens

## Audit Baseline (Current State)

### Existing Design-System Strengths
- Shared semantic token foundation exists in app/globals.css for color, spacing, typography, elevation, focus, motion, and z-index.
- Shared enterprise UI primitives exist in components/ui for buttons, cards, tables, empty/error states, overlays, and page headers.
- Motion architecture exists in components/motion with MotionProvider, reduced-motion preference, and tokenized timing/easing values.
- Layout conventions are clear: dark navigation shell and light workspace surfaces.
- Existing loading, empty, and error patterns are reusable and readable.

### Current Inconsistencies
- Production and Quantum Lab use separate token families and visual language patterns.
- Status semantics are split between workflow tone labels and Quantum severity labels.
- Focus-ring depth and control density vary between production components and Quantum components.
- Typography hierarchy is tokenized in production, but mostly utility-class driven in Quantum components.
- Motion conventions are split between global motion tokens and Quantum-local keyframes/styles.

### Reusable Quantum Patterns
- Orion insight structure is strong and transferable: observation, impact, confidence, evidence quality, limitations, and next step.
- Company Pulse composition is reusable: score, label, trend, freshness, dimensions, and limitations.
- Digital Twin placeholder patterns for nodes and links define a useful early semantic contract.
- Quantum panel variants provide useful vocabulary for future high-context surfaces.

### Current Motion Conventions
- Production uses global motion tokens and provider-based reduced-motion handling.
- Quantum Lab uses reduced-motion passthrough and local animation variables.
- Hover/transition motion in production is calm and short-duration; Quantum includes richer emphasis animation.

### Accessibility Foundations
- Visible focus indicators are present in controls and dialogs.
- Modal focus trapping and keyboard escape behavior are implemented.
- Reduced-motion support exists and can be inherited through motion context.
- Shared components support readable empty/error/loading states.

### Naming Conflicts
- The term status is overloaded:
  - workflow status for business lifecycle
  - severity status for health/intelligence urgency
- Production semantic naming and Quantum semantic naming are similar but not fully unified.
- Orion has dedicated meaning in Quantum and must not be treated as a generic assistant label.

### Production vs Quantum Visual Divergence Requiring Policy
- Production remains operationally light-surface dominant.
- Quantum remains isolated dark-surface experimental lab.
- Migration criteria are required before any Quantum style enters production.
- No production redesign is implied by this document.

## 1) Product Identity

### Official Naming
- Primary product name: B.O.S.
- Official subtitle: Bango Operating System

### Punctuation and Capitalization Rules
- B.O.S. must always include periods and all caps.
- Bango Operating System must be title case.
- Do not write BOS, B.O.S, BANGO OS, BangoOS UI, or Bango O.S.

### Usage Rules
- Use B.O.S. in compact UI contexts:
  - sidebar brand marks
  - small headers
  - badges and concise labels
- Use Bango Operating System in explanatory contexts:
  - onboarding
  - login/support copy
  - legal/about/product narrative

### Product-Family Naming Conventions
- Product shell: B.O.S.
- Intelligence assistant: Orion (within B.O.S. context)
- Experimental environment label: Quantum Lab
- Format: B.O.S. Quantum Lab

### Prohibited Variations
- BOS
- Bango OS
- B.O.S
- Bango Operating Sys
- Orion OS
- Bango Intelligence OS

### Browser Title Guidance
- Preferred format: <Screen Name> | B.O.S.
- Home/entry pages may use: B.O.S. | Bango Operating System

### App Store Naming Guidance
- App listing title: B.O.S. (if allowed length/context)
- App subtitle: Bango Operating System
- Marketing expansion line: Construction Operations Platform by Bango

### Internal Identifiers
- Internal technical identifiers remain unchanged unless separately migrated.
- No namespace refactor is implied by this document.

## 2) Brand Personality

### Must Feel
- trusted
- capable
- calm
- intelligent
- premium
- construction-specific
- operational
- alive
- enterprise-ready

### Must Not Feel
- playful
- cyberpunk
- gamified
- noisy
- decorative
- generic SaaS
- excessively futuristic
- intimidating to small contractors

### Voice by Audience
- Executives:
  - concise, high-signal, risk-aware
  - lead with outcomes, exposure, and confidence quality
- Office staff:
  - clear process language, reduced ambiguity
  - emphasize status, ownership, and next task
- Project managers:
  - schedule-impact and coordination focused
  - explicit dependencies and tradeoffs
- Foremen:
  - field-ready direction
  - short action verbs and timeline anchors
- Field employees:
  - plain language, clear safety/sequence context
  - minimal jargon and immediate next action

### Orion Tone Rules
- Orion is advisory, evidence-first, and bounded.
- Orion never presents recommendation as certainty.
- Orion distinguishes what is known, inferred, and missing.

### State Tone Rules
- Errors: factual, actionable, non-blaming
- Warnings: attention-oriented, severity-ranked
- Confirmations: clear and calm, no celebratory fluff

## 3) Core Design Principles

- Clarity before spectacle.
- Information hierarchy before density.
- Motion must communicate state, never decorate by default.
- Semantic color has one stable meaning per context.
- Unknown must never look healthy.
- Critical information must not rely on color alone.
- Enterprise depth without enterprise complexity.
- Progressive disclosure over immediate overload.
- Touch-friendly operation for field usage.
- Orion must remain explainable and auditable.
- Reduced-motion support is mandatory.
- Accessibility is part of the visual system, not a QA afterthought.

## 4) Color System (Semantic Token Contract)

This section defines token purpose and policy, not a hard-coded final palette.

### Background
- Purpose: application canvas and page baseline.
- Acceptable use: full-page and shell workspace backgrounds.
- Prohibited use: status communication.
- Contrast guidance: foreground text must meet WCAG-aware contrast.
- Dark-theme behavior: deeper neutral base, preserve readability.
- Light-theme future guidance: maintain low visual noise.
- Glow allowed: subtle atmospheric only.

### Structural Surfaces
- Purpose: layout scaffolding (shell rails, grouped surfaces).
- Acceptable use: section shells, grouped blocks.
- Prohibited use: primary content emphasis.
- Contrast guidance: headings and controls must remain distinct.
- Dark-theme behavior: use structured depth steps.
- Light-theme future guidance: soft neutral tinting.
- Glow allowed: no.

### Elevated Surfaces
- Purpose: focus and hierarchy via depth.
- Acceptable use: cards, dialogs, spotlight panels.
- Prohibited use: every container on page.
- Contrast guidance: border and shadow must remain separable.
- Dark-theme behavior: lower-opacity lifts, minimal bloom.
- Light-theme future guidance: restrained shadow stacking.
- Glow allowed: only for intelligence emphasis states.

### Borders
- Purpose: separation and grouping.
- Acceptable use: panel edges, rows, control boundaries.
- Prohibited use: decorative framing noise.
- Contrast guidance: visible without overpowering content.
- Dark-theme behavior: tone-adjusted border opacity.
- Light-theme future guidance: subtle but reliable delineation.
- Glow allowed: no.

### Primary Text
- Purpose: high-priority readable content.
- Acceptable use: titles, key values, primary body text.
- Prohibited use: disabled/inactive states.
- Contrast guidance: strongest ratio in each theme.
- Dark-theme behavior: bright neutral, not pure white glare.
- Light-theme future guidance: near-ink dark neutral.
- Glow allowed: no.

### Secondary Text
- Purpose: context and supporting explanation.
- Acceptable use: helper text, metadata, descriptions.
- Prohibited use: critical alerts and key KPIs.
- Contrast guidance: maintain readability at standard zoom.
- Dark-theme behavior: slightly muted cool-neutral.
- Light-theme future guidance: medium neutral slate.
- Glow allowed: no.

### Information
- Purpose: neutral informational state.
- Acceptable use: informational badges, highlights, indicators.
- Prohibited use: health-good implication.
- Contrast guidance: text and icon must be legible on fill.
- Dark-theme behavior: cooler cyan/blue family permitted.
- Light-theme future guidance: avoid overlap with primary action tone.
- Glow allowed: limited, low-radius.

### Healthy
- Purpose: stable and positive operational state.
- Acceptable use: completed, stable, within-threshold conditions.
- Prohibited use: unknown/stale/partial data.
- Contrast guidance: include icon/text cue beyond hue alone.
- Dark-theme behavior: avoid neon saturation.
- Light-theme future guidance: keep distinct from info and success-action.
- Glow allowed: pulse-once only for transition.

### Attention
- Purpose: watch conditions and emerging risk.
- Acceptable use: pending issues, delays, action-needed states.
- Prohibited use: normal defaults.
- Contrast guidance: support non-color indicator (icon/label).
- Dark-theme behavior: amber family with controlled luminance.
- Light-theme future guidance: avoid confusion with warning banners unless severity matches.
- Glow allowed: pulse-once for newly raised state.

### Critical
- Purpose: urgent risk, failure, blocking state.
- Acceptable use: blocking errors, critical risk, safety or financial urgency.
- Prohibited use: decorative emphasis.
- Contrast guidance: must have iconography and explicit label.
- Dark-theme behavior: strong but not bleeding neon red.
- Light-theme future guidance: high-contrast border/text pairing.
- Glow allowed: only bounded alert emphasis, never continuous decorative glow.

### Orion Intelligence
- Purpose: machine-generated intelligence and advisory context.
- Acceptable use: Orion cards, recommendation tags, confidence context.
- Prohibited use: generic system info or unrelated feature branding.
- Contrast guidance: maintain distinction from analytics and critical tones.
- Dark-theme behavior: controlled violet family with readable text.
- Light-theme future guidance: keep Orion distinct from standard analytics tone.
- Glow allowed: yes, minimal and state-bound.

### Unknown
- Purpose: data unavailable or not yet computed.
- Acceptable use: unknown values, pending pipelines.
- Prohibited use: healthy-looking green/blue styling.
- Contrast guidance: explicit UNKNOWN label required.
- Dark-theme behavior: muted neutral-amber or neutral-slate hybrid.
- Light-theme future guidance: maintain visual caution.
- Glow allowed: no.

### Stale
- Purpose: aged data beyond freshness threshold.
- Acceptable use: timestamped stale indicators, badge overlays.
- Prohibited use: live data sections without timestamp.
- Contrast guidance: pair with freshness timestamp text.
- Dark-theme behavior: amber-neutral tone with low intensity.
- Light-theme future guidance: visible but not alarm-grade unless threshold exceeded.
- Glow allowed: no.

### Disabled
- Purpose: non-interactive controls and unavailable actions.
- Acceptable use: disabled buttons, disabled menu options.
- Prohibited use: active actionable controls.
- Contrast guidance: maintain readability while signaling inactivity.
- Dark-theme behavior: reduced contrast with clear affordance loss.
- Light-theme future guidance: opacity plus cursor/state semantics.
- Glow allowed: no.

### Focus
- Purpose: keyboard and assistive navigation target.
- Acceptable use: focus ring and focused container highlight.
- Prohibited use: hover-only states.
- Contrast guidance: always visible against surrounding surface.
- Dark-theme behavior: increase luminance/alpha as needed.
- Light-theme future guidance: preserve ring thickness consistency.
- Glow allowed: only as focus ring itself.

### Selection
- Purpose: selected row/card/node/filter state.
- Acceptable use: selected table rows, active items, active nodes.
- Prohibited use: default unselected state.
- Contrast guidance: selected state must still pass text readability.
- Dark-theme behavior: use border and fill delta, not color only.
- Light-theme future guidance: preserve subtle but clear delta.
- Glow allowed: optional low-intensity accent.

## 5) Typography System

No new font dependency is required. Use existing sans and mono families.

### Role Hierarchy
- Product wordmark:
  - weight: 700
  - size: compact heading scale
  - line-height: tight
  - letter spacing: wide uppercase tracking permitted
- Executive greeting:
  - weight: 600
  - size: between section title and page title
  - line-height: comfortable
  - letter spacing: normal
- Company state:
  - weight: 500 to 600
  - size: body-large/lead
  - line-height: readable
  - letter spacing: normal
- Page title:
  - weight: 700
  - size: h1 scale
  - line-height: tight
  - letter spacing: slight negative tracking allowed
- Section title:
  - weight: 600
  - size: section title scale
  - line-height: compact
  - letter spacing: slight negative tracking allowed
- Panel title:
  - weight: 600
  - size: card/section intermediate
  - line-height: compact
  - letter spacing: neutral
- Metric value:
  - weight: 700
  - size: metric scale
  - line-height: tight
  - letter spacing: slight negative tracking
  - numeric alignment: tabular alignment strongly recommended in dense KPI views
- Metric label:
  - weight: 500 to 600
  - size: caption/body-small
  - line-height: compact
  - letter spacing: normal
- Evidence text:
  - weight: 400 to 500
  - size: body
  - line-height: readable
  - letter spacing: normal
- Limitation text:
  - weight: 400
  - size: body-small
  - line-height: readable
  - letter spacing: normal
- Timeline text:
  - weight: 500 for event title, 400 for detail
  - size: body-small
  - line-height: compact-readable
- Status labels:
  - weight: 600
  - size: badge/caption
  - line-height: compact
  - letter spacing: uppercase tracking allowed
- Orion recommendations:
  - weight: 500
  - size: body
  - line-height: readable
  - letter spacing: normal
- Dense tables:
  - header weight: 600 uppercase compact
  - cell weight: 400 to 500
  - numeric columns: right-aligned, tabular digits preferred
- Mobile field actions:
  - weight: 600
  - size: touch-legible minimum
  - line-height: compact
  - letter spacing: normal

### Global Typographic Rules
- Maximum line length:
  - body copy: 70 to 80 characters target
  - dense operational guidance: 55 to 70 characters target
- Uppercase usage:
  - allowed for small labels, badges, micro-headers
  - not allowed for long paragraphs or recommendations
- Monospace usage:
  - IDs, timestamps, structured references, machine-generated snippets
  - not for primary narrative copy

## 6) Spacing and Layout

### Spacing Scale
- Use existing spacing token scale as system source.
- Avoid ad-hoc pixel values in reusable surfaces.

### Page Gutters
- Desktop: comfortable workspace gutters aligned with shell conventions.
- Tablet: reduce outer gutter while preserving card breathing room.
- Mobile: prioritize thumb reach and action clarity.

### Panel and Vertical Rhythm
- Keep section-to-section spacing consistent within a page.
- Prioritize stronger separation between major sections than between cards in one section.

### Grid Rules
- Desktop:
  - support 2-column and 3-column analytical layouts where appropriate
  - use hierarchy-based asymmetry when one column is decision-critical
- Tablet:
  - collapse tertiary columns first
  - preserve key metrics near top
- Mobile:
  - single-column stacking by default
  - actions and statuses should remain visible without horizontal scroll when possible

### Max Widths
- Keep long-form content within readable max width.
- Data-dense pages may extend wider but must maintain legible grouping.

### Density Modes
- Standard density default for office workflows.
- Compact density allowed for table-heavy roles.
- Never reduce touch targets below accessible minimums in any density mode.

### Whitespace Philosophy
- Whitespace is a signal of hierarchy, not luxury decoration.
- Do not fill all available space with equal-weight cards.

### Asymmetric Layout Rules
- Asymmetry is allowed when it clarifies priority.
- Asymmetry is not allowed when it causes hidden or ambiguous action flow.

### First-Viewport Priorities
- Top viewport should answer:
  - What is happening now?
  - What needs action first?
  - What confidence/limitations apply?

### Safe-Area Guidance
- Respect mobile safe areas for nav/actions in future native and web-mobile implementations.

## 7) Panel Philosophy

Avoid pages made entirely of equal bordered cards.

### Open Panel
- Use for integrated content with no container chrome.
- Border: none.
- Background: transparent.
- Shadow: none.
- Motion: minimal entry only.
- Accessibility: heading hierarchy still required.
- Anti-pattern: using open panels when content boundaries are unclear.

### Grouped Panel
- Use for related sub-sections in one logical block.
- Border: subtle.
- Background: grouped-surface tone.
- Shadow: none or subtle.
- Motion: subtle fade/slide.
- Accessibility: group label and section heading required.
- Anti-pattern: over-nesting grouped panels.

### Elevated Panel
- Use for high-priority metrics/recommendations.
- Border: subtle or transparent with depth separation.
- Background: elevated-surface tone.
- Shadow: moderate.
- Motion: restrained lift-in.
- Accessibility: ensure focus and reading order remain clear.
- Anti-pattern: elevating every card equally.

### Focused Panel
- Use for selected or currently-active task context.
- Border: focus/selection semantic border.
- Background: slight emphasis.
- Shadow: low to moderate.
- Motion: quick attention transition.
- Accessibility: non-color indicator required.
- Anti-pattern: permanent focus styling on non-active elements.

### Critical Panel
- Use for urgent blocking or severe conditions.
- Border: critical semantic.
- Background: restrained critical tint.
- Shadow: optional alert emphasis.
- Motion: bounded pulse on state transition only.
- Accessibility: explicit icon + label + action guidance required.
- Anti-pattern: continuous alarming animation.

### Orion Panel
- Use for intelligence observations and recommendations.
- Border: Orion semantic.
- Background: intelligence surface.
- Shadow: controlled premium emphasis.
- Motion: subtle activity indicator only when useful.
- Accessibility: evidence and limitation text required.
- Anti-pattern: using Orion panel style for generic content.

### Transparent Panel
- Use for overlays on rich visualization where chrome would hinder context.
- Border: optional subtle edge.
- Background: translucent with contrast-safe text.
- Shadow: minimal.
- Motion: minimal.
- Accessibility: guarantee text contrast against backdrop.
- Anti-pattern: transparent text over visually noisy backgrounds.

### Embedded Panel
- Use for inline sub-workflow within parent panel.
- Border: light divider or inset frame.
- Background: slight tonal shift.
- Shadow: none.
- Motion: none by default.
- Accessibility: preserve heading levels and control labels.
- Anti-pattern: embedded panel used as fake modal.

### Data-Dense Panel
- Use for tables, timelines, workload lists, and heavy operations data.
- Border: clear structure.
- Background: high readability first.
- Shadow: minimal.
- Motion: functional only (sorting/filter updates).
- Accessibility: keyboard and reading order mandatory.
- Anti-pattern: dense panel without filtering or prioritization.

## 8) Motion Language

Motion must be calm, informative, and finite.
No constant decorative animation.

### Entrance
- Duration: 140ms to 260ms
- Easing intention: confident settle
- Frequency: on view entry only
- Looping: no
- Reduced-motion fallback: opacity-only or no animation
- Layout shift: no content jump
- Performance limit: avoid expensive transforms on large surfaces

### Status Change
- Duration: 120ms to 220ms
- Easing intention: immediate clarity
- Frequency: only on state transitions
- Looping: no
- Reduced-motion fallback: direct style swap
- Layout shift: none
- Performance limit: class/tone update only

### Selection
- Duration: 120ms to 200ms
- Easing intention: precise confirmation
- Frequency: on selection toggle
- Looping: no
- Reduced-motion fallback: static selection style
- Layout shift: none
- Performance limit: border/background/focus ring only

### Success
- Duration: 160ms to 260ms
- Easing intention: calm completion
- Frequency: upon completion only
- Looping: no
- Reduced-motion fallback: static state indicator
- Layout shift: none
- Performance limit: no large glow spreads

### Warning
- Duration: 160ms to 280ms
- Easing intention: attention cue
- Frequency: on escalation only
- Looping: limited; if looping, slow and cancellable
- Reduced-motion fallback: static icon + label
- Layout shift: none
- Performance limit: single-layer pulse max

### Critical
- Duration: 160ms to 320ms
- Easing intention: urgency without panic
- Frequency: on new critical event and acknowledgement transitions
- Looping: generally no; if used, low-frequency and opt-out
- Reduced-motion fallback: static high-contrast state
- Layout shift: none
- Performance limit: avoid global flashing effects

### Orion Activity
- Duration: 220ms to 900ms depending on indicator type
- Easing intention: active reasoning presence
- Frequency: only when analysis is actively refreshing
- Looping: yes, only while active and within panel scope
- Reduced-motion fallback: static activity text
- Layout shift: none
- Performance limit: single micro-indicator, no full-panel shimmer

### Company Pulse
- Duration: 200ms to 320ms for updates
- Easing intention: health stability
- Frequency: when score or dimension changes
- Looping: no persistent loop for stable states
- Reduced-motion fallback: no animated bar growth
- Layout shift: none
- Performance limit: transform/opacity preferred

### Timeline Updates
- Duration: 160ms to 240ms
- Easing intention: chronological insertion clarity
- Frequency: on new event insertion
- Looping: no
- Reduced-motion fallback: immediate insertion with highlight
- Layout shift: bounded and predictable
- Performance limit: batch updates where possible

### Navigation Transitions
- Duration: 180ms to 300ms
- Easing intention: orientation continuity
- Frequency: route or major panel transitions only
- Looping: no
- Reduced-motion fallback: instant or fade-only
- Layout shift: avoid reflow flash
- Performance limit: GPU-friendly transforms only

### Loading
- Duration: short, non-distracting loops
- Easing intention: waiting awareness
- Frequency: only while loading
- Looping: yes, bounded and stoppable
- Reduced-motion fallback: static text + progress cues
- Layout shift: none
- Performance limit: low-complexity indicators

### Startup Sequence
- Duration: see startup specification section
- Easing intention: confidence and readiness
- Frequency: only when useful
- Looping: no
- Reduced-motion fallback: text-first sequence
- Layout shift: no jump cut after completion
- Performance limit: avoid heavy compositing on startup

## 9) Company Pulse Specification

Company Pulse is an operational health contract, not a decorative score.

### Required Elements
- Overall score
- Health label
- Trend direction and period
- Freshness indicator
- Data completeness indicator
- Contributing dimensions
- Limitations/missing-data statement
- Unknown state
- Stale state
- Critical state
- Drill-down behavior
- Animation behavior
- Accessibility label
- Fixture-vs-live data labeling

### Honesty Rules
- Score must never imply certainty when source data is incomplete.
- If data completeness is below threshold, score presentation must visibly include partial/unknown context.
- Unknown and stale must never use healthy visual cues.

### Drill-Down Behavior
- Selecting a dimension reveals:
  - source signals
  - freshness window
  - uncertainty notes
  - next-action linkage

### Animation Behavior
- Animate on change only.
- No constant breathing bars for stable values.
- Reduced-motion mode uses static updates.

### Accessibility Label Contract
- Include a machine-readable summary equivalent to:
  - Company Pulse score
  - trend
  - freshness
  - confidence/limitations presence

### Fixture vs Live Labeling
- Explicitly label fixture/simulated data as fixture.
- Live data must include last-updated context.

## 10) Orion Visual and Communication Specification

Orion is not a generic chatbot.

### Required Presentation Structure
- Observation
- Why it matters
- Evidence
- Confidence or evidence quality
- Limitations
- Recommended next step
- Alternatives
- Approval boundary

### Orion Color Usage
- Reserve Orion semantic tone for intelligence content only.
- Do not use Orion tone for generic info, success, or warnings.

### Orion Mark Behavior
- Orion visual mark may appear in advisory contexts only.
- Mark should not appear on unrelated navigation or static module headings.

### Orion Voice Rules
- Sentence length: short to medium, high information density.
- Tone: calm, evidence-led, bounded confidence.
- No hype language.

### Silence Rules
- Orion should remain silent when:
  - no meaningful delta exists
  - evidence quality is too low for recommendation
  - action would exceed user permission boundary

### Uncertainty Rules
- Orion must explicitly state uncertainty with cause.
- Separate fact, prediction, and recommendation labels.

### Fact vs Prediction vs Recommendation Contract
- Fact: observed operational data statement.
- Prediction: projected outcome based on model/heuristic.
- Recommendation: proposed action with rationale and tradeoff.

### Contextual Surfacing
- Executive context: impact-first and confidence summary.
- Operational context: task-first and sequencing details.

## 11) Digital Twin Specification

Three.js or WebGL must remain optional, never required for comprehension.

### Required Representations
- Projects
- Crews
- Employees
- Equipment
- Deliveries
- Inspections
- Financial links
- Schedule links
- Alerts
- Selections
- Unavailable data
- Stale data

### Node Hierarchy
- Primary nodes: project and operation anchors.
- Secondary nodes: crew, equipment, employee, delivery, inspection.
- Tertiary overlays: alert and limitation indicators.

### Link Hierarchy
- Primary links: schedule-critical dependencies.
- Secondary links: resource and support dependencies.
- Financial links: visually distinct but subordinate to operational critical paths.

### Interaction Contract
- Selection behavior:
  - selected node gets clear focus and non-color indicator
- Hover/focus behavior:
  - quick preview, no mandatory tooltip for comprehension
- Keyboard interaction:
  - tab/select pathway with visible focus and summary output
- Drill-down behavior:
  - open context panel with evidence, freshness, and recommended action

### Motion Limits
- Motion should reinforce relationship updates only.
- Avoid continuous scene drift or ornamental movement.

### 2D Fallback
- Provide list or schematic mode with same semantic content.
- Fallback must include node state, link type, and alerts.

### Future 3D Guidance
- 3D can be additive for orientation and scenario analysis.
- Core operational understanding must remain complete in 2D fallback.

### Performance Degradation Strategy
- Progressive level-of-detail for dense graphs.
- degrade visual effects before degrading semantic data.

## 12) Iconography

### Style Rules
- Prefer line-first style with consistent stroke weight.
- Filled icons allowed only for critical semantic emphasis or compact status markers.

### Semantic Usage
- One icon meaning per context; avoid icon repurposing ambiguity.
- Construction-specific icons should map to domain concepts users already understand.

### Status Requirements
- Status icon should pair with text label in critical workflows.
- Do not rely on icon shape alone for severity.

### Icon + Text Behavior
- Keep icon alignment baseline-consistent.
- Use consistent spacing between icon and label.

### Touch Targets
- Minimum touch target must remain field-friendly.

### Decorative Icon Rules
- Decorative icons must not compete with status/action semantics.
- Decorative icons should be hidden from assistive output when non-semantic.

### Accessibility Labels
- Interactive icons require clear accessible labels.

## 13) Data Visualization

Charts must remain readable without animation.

### Rules by Data Type
- Metrics:
  - clear current value, comparison period, and trend direction
- Trends:
  - show time basis and confidence context where predictive
- Timelines:
  - preserve chronological order and event severity markers
- Schedules:
  - reveal critical path impacts first
- Financial charts:
  - expose variance and risk thresholds, not aesthetics-first gradients
- Workload/utilization:
  - separate planned vs actual when possible
- Confidence:
  - include confidence/evidence quality where model-derived
- Freshness:
  - always show data age where operationally relevant
- Missing data:
  - mark clearly and avoid interpolation that appears factual
- Comparisons:
  - normalize scales and state baseline windows
- Alerts:
  - alerts must be visible in static snapshots

## 14) Tables and Dense Workflows

### Required Standards
- Row height: readable and scannable for office and field review.
- Column density: compact but not cramped.
- Sticky headers: use where table length requires continuity.
- Sorting: clear active sort indicator.
- Filters: grouped and discoverable.
- Selection: explicit selected state and count when multi-select.
- Bulk actions: clear scope and confirmation where destructive.
- Status placement: consistent column location.
- Inline editing: distinguish draft vs saved state.
- Empty states: explain why empty and what to do next.
- Loading states: use skeletons/spinners with context.
- Mobile fallback: card/list transformation with preserved key fields.
- Keyboard use: navigable controls and focus order.

## 15) Forms and Actions

### Action Types
- Primary action:
  - highest-priority write/advance step
- Secondary action:
  - supporting navigation or save-later path
- Destructive action:
  - explicit danger styling and confirmation boundary
- Advisory action:
  - non-destructive recommendation or helper action
- Orion-prepared action:
  - suggested by Orion, still requires explicit human confirmation when write-impacting
- Disabled action:
  - clearly disabled with reason where possible
- Loading action:
  - busy state with duplicate submission protection
- Confirmation:
  - required for destructive or irreversible operations
- Error recovery:
  - visible path to retry, rollback, or safe exit

### Write vs Read-Only Distinction
- Meaningful write actions must remain visually and semantically distinct from read-only recommendations.

## 16) States

Every data-driven surface should support and clearly represent:
- loading
- empty
- partial
- stale
- unknown
- unavailable
- success
- warning
- critical
- offline
- syncing
- permission denied
- prototype
- fixture-only
- reduced-motion

### Required State Behaviors
- Partial must explain what is present vs missing.
- Unknown must never render with healthy tone.
- Fixture-only must be labeled in labs/prototypes.
- Permission denied must provide safe next step where possible.

## 17) Responsive and Mobile Principles

### Role-Oriented Device Context
- Desktop office usage:
  - support multi-panel analysis and dense workflows
- Tablet superintendent usage:
  - prioritize quick status scan and assignment actions
- Mobile field usage:
  - prioritize immediate action and upload/reporting flows

### Mobile Design Rules
- Use large touch targets.
- Prioritize single-hand actions for core field tasks.
- Keep offline awareness visible.
- Support camera and upload workflows with clear progress and retries.
- Mobile navigation should reduce hierarchy depth per screen.
- Do not copy desktop table density directly to mobile.

### Native Mobile Future Guidance
- Reuse semantic contracts, not desktop layout assumptions.
- Preserve identity and state semantics across platforms.

Note: This phase does not modify existing production mobile menu behavior.

## 18) Accessibility Standard

### Baseline Requirements
- WCAG-aware contrast targets for text and controls
- visible focus indicators
- full keyboard navigation support
- screen-reader labels for interactive controls
- semantic heading structure
- reduced-motion support
- text alternatives for non-text semantics
- non-color status indicators
- touch target accessibility
- zoom support
- readable typography at common scale levels
- clear error identification and recovery guidance
- explicit form labels

### Non-Negotiable Rule
- Accessibility is a first-class visual-system requirement and must not be deferred.

## 19) Startup Experience (Specification Only)

Future sequence example:
- B.O.S.
- Bango Operating System
- Initializing Company Intelligence
- Synchronizing Operations
- Loading Workforce Intelligence
- Starting Orion
- Mission Control Ready

### Rules
- Maximum perceived duration: short and bounded.
- Skip behavior: allow fast return for repeat users when readiness state permits.
- Only show when useful: avoid ceremonial startup on every navigation.
- No fake technical steps: only truthful operational stages.
- Reduced-motion version: text-first with minimal transitions.
- Returning-user shortcut: direct path when data is warm.
- Offline/error state: explicit fallback messaging and retry path.
- Accessibility announcement: sequence must be screen-reader friendly.

This section is specification only and does not imply implementation in this phase.

## 20) Implementation Rules for Copilot

Every future B.O.S. visual implementation prompt must follow this checklist:
- audit first
- use semantic tokens
- reuse components
- do not query data from presentation components
- fixture-first for labs
- no global theme changes without approval
- no new animation dependency without review
- preserve reduced motion
- preserve accessibility
- validate desktop/tablet/mobile
- run tests
- stop before commit

## 21) Design Review Checklist

Use this checklist before approving any screen:
- Is the primary user question obvious?
- Are the top three priorities clear?
- Is unknown data represented honestly?
- Is Orion explainable?
- Is motion meaningful?
- Is the layout too dense?
- Are actions clearly differentiated?
- Does it work without animation?
- Does it remain usable on mobile?
- Does it look recognizably like B.O.S.?
- Does it improve the task rather than merely look futuristic?

## 22) Design Debt and Migration

### Current Systems
- Production visual system: tokenized enterprise light-surface system.
- Quantum Lab visual system: isolated dark-surface experimental system.

### Migration Policy
- No big-bang redesign.
- Migrate approved Quantum patterns component-by-component.
- Use feature flags where needed.
- Maintain rollback strategy for each migrated surface.
- Require visual regression testing for migration steps.

### Migration Readiness Criteria
- Semantic meaning parity with production rules
- Accessibility parity (focus, contrast, keyboard, reduced motion)
- Responsive behavior parity (desktop, tablet, mobile)
- Clear state coverage (loading/empty/unknown/stale/error)

### Rollback Strategy
- Keep production component fallback path until migration is verified.
- Revert by feature flag when regressions impact workflow clarity or accessibility.

### Versioning the Design Bible
- Version as v1.x for additive policy clarification.
- Version as v2.0 only for major semantic contract changes.
- Record migration notes for each section that changes operational implementation guidance.

## Implementation Notes for This Phase

- This document defines policy and contracts only.
- No production pages, app shell, database, Supabase, Orion logic, or business module behavior is changed by this documentation phase.
