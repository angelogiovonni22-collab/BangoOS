import { ORION_NAVIGATION_ROUTES } from "@/lib/orion/navigation";

const CREATE_ROUTES = new Set([
  "/change-orders/new",
  "/cost-codes/new",
  "/crews/new",
  "/customers/new",
  "/daily-reports/new",
  "/employees/new",
  "/equipment/new",
  "/estimates/new",
  "/invoices/new",
  "/labor-rates/new",
  "/materials/new",
  "/projects/new",
  "/units-of-measure/new",
  "/vendors/new",
]);

const KNOWN_STATIC_ROUTES = new Set([
  ...ORION_NAVIGATION_ROUTES.map((route) => route.href),
  ...CREATE_ROUTES,
  "/crews/field",
  "/crews/operations",
  "/dispatch/forecast",
  "/materials/procurement",
  "/scheduling",
  "/scheduling/calendar",
  "/scheduling/dispatch",
  "/scheduling/forecast",
]);

const RECORD_ROUTE = /^\/(change-orders|cost-codes|crews|customers|daily-reports|employees|equipment|estimates|invoices|labor-rates|materials|projects|units-of-measure|vendors)\/[0-9a-f-]+(?:\/edit)?$/i;

export const ORION_OPERATOR_MAIN_ROUTES = ORION_NAVIGATION_ROUTES.map((route) => route.href);

export function resolveKnownOrionOperatorHref(value: unknown) {
  if (typeof value !== "string") return null;
  const href = value.trim();
  if (!href.startsWith("/") || href.startsWith("//")) return null;
  const pathname = href.split(/[?#]/, 1)[0] || "";
  const normalizedPathname = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const staticRoute = [...KNOWN_STATIC_ROUTES].find((route) => route.toLowerCase() === normalizedPathname.toLowerCase());
  if (staticRoute) {
    return `${staticRoute}${href.slice(pathname.length)}`;
  }

  return RECORD_ROUTE.test(normalizedPathname) ? `${normalizedPathname}${href.slice(pathname.length)}` : null;
}

export function isKnownOrionOperatorHref(value: unknown) {
  return Boolean(resolveKnownOrionOperatorHref(value));
}
