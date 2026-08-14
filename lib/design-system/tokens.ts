export type EnterpriseStatusTone = "neutral" | "brand" | "info" | "success" | "warning" | "danger" | "analytics";

export const typographyTokens = {
  display: "text-display",
  pageTitle: "text-h1",
  workspaceTitle: "text-h2",
  h1: "text-h1",
  h2: "text-h2",
  h3: "text-h3",
  sectionTitle: "text-section-title",
  cardTitle: "text-card-title",
  body: "text-body",
  bodySecondary: "text-body-secondary",
  label: "text-label",
  metadata: "text-metadata",
  caption: "text-caption",
  badgeText: "text-badge",
  tableHeader: "text-table-header",
  tableBody: "text-table-body",
  buttonLabel: "text-button-label",
  formControl: "text-control",
} as const;

export const spacingTokens = {
  pageSection: "var(--space-6)",
  cardPadding: "var(--space-5)",
  compactCardPadding: "var(--space-4)",
  toolbarPadding: "var(--space-4)",
  mobilePagePadding: "var(--space-4)",
  controlGap: "var(--space-3)",
  formFieldGap: "var(--space-3)",
  actionGap: "var(--space-3)",
  gridGap: "var(--space-3)",
  tableCellX: "var(--space-5)",
  tableCellY: "var(--space-3)",
} as const;

export const controlTokens = {
  heightSm: "var(--control-height-sm)",
  heightMd: "var(--control-height-md)",
  heightLg: "var(--control-height-lg)",
} as const;

export const radiusTokens = {
  card: "var(--radius-card)",
  control: "var(--radius-control)",
  badge: "var(--radius-badge)",
  row: "var(--radius-row)",
} as const;

export const elevationTokens = {
  card: "var(--shadow-card)",
  raised: "var(--shadow-raised)",
  hover: "var(--shadow-hover)",
} as const;

export const containerTokens = {
  page: "var(--container-page-max)",
  content: "var(--container-content-max)",
  narrow: "var(--container-narrow-max)",
} as const;

export const gridTokens = {
  compactGap: "var(--grid-gap-compact)",
  baseGap: "var(--grid-gap-base)",
  spaciousGap: "var(--grid-gap-spacious)",
} as const;

export const transitionTokens = {
  fast: "var(--duration-fast)",
  base: "var(--duration-base)",
  slow: "var(--duration-slow)",
  easingStandard: "var(--ease-standard)",
  easingDecelerate: "var(--ease-decelerate)",
} as const;

export const zIndexTokens = {
  base: 1,
  header: 20,
  overlay: 40,
  modal: 60,
  toast: 70,
} as const;

export const colorTokens = {
  appBackground: "var(--color-background-root)",
  workspaceBackground: "var(--color-background-workspace)",
  surface: "var(--color-surface-card)",
  surfaceElevated: "var(--color-surface-elevated)",
  surfaceSubtle: "var(--color-surface-subtle)",
  borderSubtle: "var(--color-border-subtle)",
  borderStrong: "var(--color-border-strong)",
  textPrimary: "var(--color-text-primary)",
  textSecondary: "var(--color-text-secondary)",
  textMuted: "var(--color-text-muted)",
  actionPrimary: "var(--color-action-primary)",
  actionPrimaryHover: "var(--color-action-primary-hover)",
  focus: "var(--color-focus)",
  selected: "var(--color-selected)",
  disabledBg: "var(--color-disabled-bg)",
  disabledText: "var(--color-disabled-text)",
  disabledBorder: "var(--color-disabled-border)",
  accent: "var(--color-brand-600)",
  brand: "var(--color-brand-600)",
  success: "var(--color-success-500)",
  warning: "var(--color-warning-500)",
  danger: "var(--color-danger-500)",
  info: "var(--color-info-500)",
  analytics: "var(--color-analytics-500)",
  neutral: "var(--color-neutral-500)",
} as const;

export const gradientTokens = {
  workspaceShell: "var(--workspace-shell-surface)",
  workspaceLoading: "var(--workspace-loading-surface)",
  workspaceHeader: "var(--workspace-header-surface)",
  workspaceHero: "var(--workspace-hero-surface)",
  workspaceHeroPanel: "var(--workspace-hero-panel-surface)",
  workspaceTabs: "var(--workspace-tabs-surface)",
  workspaceTabActive: "var(--workspace-tab-active-surface)",
} as const;

export const statusTones = {
  active: "success",
  completed: "success",
  complete: "success",
  done: "success",
  planning: "info",
  "in progress": "info",
  in_progress: "info",
  open: "info",
  "on hold": "warning",
  on_hold: "warning",
  overdue: "danger",
  pending: "warning",
  draft: "neutral",
  archived: "neutral",
  closed: "neutral",
  sent: "brand",
  viewed: "info",
  submitted: "warning",
  pending_approval: "warning",
  "pending approval": "warning",
  approved: "success",
  invoiced: "info",
  delayed: "danger",
  reviewed: "info",
  blocked: "danger",
  cancelled: "danger",
  late: "danger",
  at_risk: "warning",
  incident: "danger",
  rejected: "danger",
  expired: "danger",
  void: "neutral",
} as const satisfies Record<string, EnterpriseStatusTone>;

export function getEnterpriseStatusTone(status: string): EnterpriseStatusTone {
  return statusTones[status.toLowerCase() as keyof typeof statusTones] || "neutral";
}
