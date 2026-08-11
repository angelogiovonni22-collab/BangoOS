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

export function isKnownOrionOperatorHref(value: unknown) {
  if (typeof value !== "string") return false;
  const href = value.trim();
  if (!href.startsWith("/") || href.startsWith("//")) return false;
  const pathname = href.split(/[?#]/, 1)[0] || "";
  return KNOWN_STATIC_ROUTES.has(pathname) || RECORD_ROUTE.test(pathname);
}
