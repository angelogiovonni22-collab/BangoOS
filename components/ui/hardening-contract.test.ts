import fs from "node:fs";
import path from "node:path";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  + ${message}`);
    passed += 1;
  } else {
    console.error(`  x FAIL: ${message}`);
    failed += 1;
  }
}

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function main(): void {
  const layout = read("app/layout.tsx");
  const aliases = read("app/legacy-token-aliases.css");
  const globals = read("app/globals.css");
  const appContentSurface = read("app/app-content-surface.css");
  const visualConsistency = read("app/visual-consistency.css");
  const pageHeader = read("components/ui/page-header.tsx");
  const sectionHeader = read("components/ui/section-header.tsx");
  const input = read("components/ui/input.tsx");
  const button = read("components/ui/button.tsx");
  const card = read("components/ui/card.tsx");
  const summaryCard = read("components/ui/summary-card.tsx");
  const table = read("components/ui/enterprise-table.tsx");
  const tableContainer = read("components/ui/table-container.tsx");
  const workspaceNavigation = read("components/workspace/workspace-navigation.tsx");
  const workspaceShell = read("components/workspace/workspace-shell.tsx");
  const themeGalleryHardening = read("app/theme-gallery-hardening.css");
  const projectPage = read("app/(app)/projects/[id]/page.tsx");
  const projectMemory = read("components/projects/workspace/project-memory-capture-panel.tsx");
  const projectTimeline = read("components/projects/workspace/project-work-operations-timeline.tsx");
  const projectSitecam = read("components/projects/workspace/project-work-sitecam-panel.tsx");
  const plansSidebar = read("components/plans/plans-sidebar.tsx");

  assert(layout.includes('import "./legacy-token-aliases.css";'), "root layout loads legacy token aliases");
  assert(layout.includes('import "./app-content-surface.css";'), "root layout loads the app content surface contract");

  for (const token of [
    "--text-primary",
    "--text-secondary",
    "--text-muted",
    "--surface-default",
    "--surface-raised",
    "--border-subtle",
    "--border-default",
    "--border-strong",
  ]) {
    assert(aliases.includes(`${token}:`), `legacy alias ${token} is defined`);
  }

  assert(globals.includes(".bg-white {"), "global light surfaces own a readable token cascade");
  assert(globals.includes("--color-text-primary: var(--bos-text-strong-on-light);"), "light surface primary text resolves to dark readable text");
  assert(globals.includes("--color-text-secondary: var(--bos-text-medium-on-light);"), "light surface secondary text resolves to readable supporting text");

  assert(appContentSurface.includes(".enterprise-shell main {"), "authenticated main content establishes a light-surface semantic context");
  assert(appContentSurface.includes("color: var(--bos-text-strong-on-light);"), "plain inherited main-content text is dark on the light shell");
  assert(appContentSurface.includes("--color-text-primary: var(--bos-text-strong-on-light);"), "main-content semantic primary text is dark on light");
  assert(appContentSurface.includes("--color-text-secondary: var(--bos-text-medium-on-light);"), "main-content semantic secondary text is readable on light");
  assert(appContentSurface.includes("--color-surface-card: var(--bos-bg-workspace-card);"), "semantic cards default to a light surface inside the light application canvas");
  assert(appContentSurface.includes(".enterprise-shell main .bf-material-blueprint"), "light BangoFlow materials reassert the light-surface contract");

  assert(pageHeader.includes("var(--bos-text-strong-on-light)"), "page header title uses explicit readable on-light text");
  assert(pageHeader.includes("var(--bos-text-medium-on-light)"), "page header eyebrow and supporting copy use explicit readable on-light text");
  assert(pageHeader.includes("border-[var(--bos-border-light)]"), "page header divider uses the light-surface border token");
  assert(pageHeader.includes("min-w-0"), "page header protects narrow layouts from intrinsic overflow");

  assert(sectionHeader.includes("var(--color-text-primary)"), "section header title is surface-aware");
  assert(sectionHeader.includes("var(--color-text-secondary)"), "section header supporting copy is surface-aware");
  assert(sectionHeader.includes("min-w-0"), "section header protects narrow layouts from intrinsic overflow");

  assert(card.includes("text-[var(--color-text-primary)]"), "card title follows surface-aware primary text token");
  assert(card.includes("text-[var(--color-text-secondary)]"), "card description follows surface-aware secondary text token");
  assert(card.includes("border-[var(--color-border-subtle)]"), "card borders follow surface-aware border tokens");
  assert(card.includes("bg-[var(--color-surface-card)]"), "default and KPI Card materials follow the active surface context");
  assert(card.includes("bg-[var(--color-surface-elevated)]"), "elevated Card material follows the active surface context");
  assert(!card.includes("[--color-text-primary:var(--bos-text-primary)]"), "Card no longer forces light-on-dark text into light workspaces");
  assert(!card.includes("[--color-text-secondary:var(--bos-text-secondary)]"), "Card no longer forces light secondary text into light workspaces");
  assert(summaryCard.includes("text-[var(--color-text-primary)]"), "summary card values follow the active surface text context");
  assert(summaryCard.includes("text-[var(--color-text-secondary)]"), "summary card labels and context follow the active surface text context");

  assert(button.includes("outline:\n      \"border border-[var(--color-border-strong)] bg-transparent text-[var(--color-text-primary)]"), "outline buttons use surface-aware readable text and borders");
  assert(button.includes("ghost:\n      \"border border-transparent bg-transparent text-[var(--color-text-secondary)]"), "ghost buttons use surface-aware supporting text");
  assert(button.includes("toolbar:\n      \"border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] text-[var(--color-text-secondary)]"), "toolbar buttons use context-aware surfaces and text");

  assert(input.includes("placeholder:text-[var(--color-text-muted)]"), "input placeholder follows surface-aware muted text token");
  assert(input.includes("hover:border-[var(--color-border-strong)]"), "input hover border follows surface-aware border token");

  assert(table.includes("max-w-full overflow-x-auto"), "enterprise table contains horizontal overflow locally");
  assert(table.includes("bg-[var(--bos-bg-control)]"), "enterprise table header uses a dark owned surface with readable heading text");
  assert(tableContainer.includes("text-[var(--bos-text-strong-on-light)]"), "light table container header uses explicit on-light title text");

  for (const token of [
    "workspace-header-surface",
    "workspace-hero-surface",
    "workspace-hero-panel-surface",
    "workspace-hero-badge-surface",
    "workspace-tabs-surface",
    "workspace-tab-active-surface",
  ]) {
    assert(workspaceNavigation.includes(`[background:var(--${token})]`), `${token} is applied as a background image-capable property`);
  }

  assert(workspaceShell.includes("[background:var(--workspace-shell-surface)]"), "workspace shell renders its gradient surface instead of invalid background-color");
  assert(workspaceShell.includes("[background:var(--workspace-loading-surface)]"), "workspace loading state renders its gradient surface");
  assert(!workspaceNavigation.includes("bg-[var(--workspace-header-surface)]"), "workspace header no longer treats a gradient token as a background color");
  assert(!workspaceShell.includes("bg-[var(--workspace-shell-surface)]"), "workspace shell no longer treats a gradient token as a background color");
  assert(workspaceNavigation.match(/data-bos-surface="dark"/g)?.length === 3, "workspace header, hero, and tabs own an explicit dark semantic surface");
  assert(pageHeader.includes('data-bos-surface="light"'), "shared page header owns an explicit light semantic surface");
  assert(visualConsistency.includes('[data-bos-surface="light"]'), "visual consistency layer defines the light surface contract");
  assert(visualConsistency.includes('[data-bos-surface="dark"]'), "visual consistency layer defines the dark surface contract");
  assert(visualConsistency.includes(":where(.enterprise-shell main h1"), "global heading defaults use zero specificity so owned surface colors can win");
  assert(!visualConsistency.includes(".enterprise-shell main :is(h1, h2, h3, h4, h5, h6)"), "global heading rule cannot override component-owned dark-surface text");

  assert(themeGalleryHardening.includes('[data-theme="high-contrast"]'), "High Contrast has an explicit hardening contract");
  assert(themeGalleryHardening.includes("--workspace-shell-surface: linear-gradient(180deg, #ffffff"), "High Contrast workspace shells stay light instead of falling back to the legacy navy shell");
  assert(themeGalleryHardening.includes("--workspace-header-title: #07111e"), "High Contrast workspace header titles use readable dark text");
  assert(themeGalleryHardening.includes("--workspace-tabs-surface: linear-gradient(180deg, #ffffff"), "High Contrast shared workspace tabs use the light theme material");
  assert(themeGalleryHardening.includes('[data-bos-surface="dark"]'), "High Contrast normalizes legacy shared dark-surface workspaces");
  assert(themeGalleryHardening.includes(".project-workspace-root"), "High Contrast contains a project-workspace legacy skin override");
  assert(themeGalleryHardening.includes('[data-project-overview-command-center]'), "High Contrast normalizes the project Overview command center");
  assert(themeGalleryHardening.includes('[data-project-scope-of-work]'), "High Contrast normalizes Scope of Work");
  assert(themeGalleryHardening.includes('[data-project-header-jobsite-intelligence="true"]'), "High Contrast normalizes project weather/jobsite intelligence");
  assert(projectPage.includes('<WorkspaceShell className="project-workspace-root">'), "project workspace exposes a stable theme-hardening root");
  assert(!projectPage.includes('activeTab === "scope"\n          ? "min-w-0 rounded-[20px] border border-[#173957]'), "Scope of Work no longer forces a navy outer workspace in light themes");
  assert(!projectMemory.includes("bg-[#071a33]"), "Tasks business-memory controls cannot force the legacy navy input background");
  assert(projectMemory.includes("bg-[var(--color-surface-card)]"), "Tasks business-memory controls follow the active theme surface");
  assert(!projectTimeline.includes("bg-[#071a33]"), "Tasks timeline filters cannot force the legacy navy input background");
  assert(!projectSitecam.includes("bg-[#071a33]"), "Tasks SiteCam filters cannot force the legacy navy input background");
  assert(!plansSidebar.includes("bg-slate-950"), "Blueprint discipline navigation cannot force a black/navy sidebar");
  assert(plansSidebar.includes("bg-[var(--color-surface-card)]"), "Blueprint discipline navigation follows the active theme surface");
  assert(plansSidebar.includes("text-[var(--color-text-primary)]"), "Blueprint discipline navigation follows active theme text tokens");

  console.log(`\nHardening contract results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
