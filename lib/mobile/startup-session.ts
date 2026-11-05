// A tab-scoped marker suppresses repeat intros without storing account or business data.
const STARTUP_SESSION_KEY = "bos-startup-intro-seen-v1";
export const startupSessionBootstrap = `(() => {
  const root = document.documentElement;
  let seen = false;
  try {
    seen = sessionStorage.getItem("${STARTUP_SESSION_KEY}") === "1";
    sessionStorage.setItem("${STARTUP_SESSION_KEY}", "1");
  } catch {}
  root.dataset.bosStartup = seen ? "skip" : "show";
  if (seen) root.classList.remove("bos-startup-prepaint");
})();`;

export function claimStartupIntro(root: { dataset: { bosStartup?: string } }): boolean {
  if (root.dataset.bosStartup === "skip" || root.dataset.bosStartup === "claimed") return false;
  root.dataset.bosStartup = "claimed";
  return true;
}
