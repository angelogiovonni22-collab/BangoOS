import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  canAccessPath,
  canUseOrion,
  getRoleHomePath,
  permissionForPath,
  type PermissionOverrides,
} from "@/lib/access-control/permissions";
import { getSupabaseEnv } from "@/lib/supabase/env";

const AUTH_PATHS = ["/login", "/signup"];

function isAuthPath(pathname: string) {
  return AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isOrionApiPath(pathname: string) {
  return pathname === "/api/orion" || pathname.startsWith("/api/orion/");
}

function isAuthorizedBosAppPath(pathname: string) {
  return permissionForPath(pathname) !== null
    || pathname === "/partner"
    || pathname.startsWith("/partner/")
    || pathname === "/customer-portal"
    || pathname.startsWith("/customer-portal/");
}

function isSensitiveBearerPath(pathname: string) {
  return pathname.startsWith("/contracts/estimate/")
    || pathname.startsWith("/subcontracts/")
    || pathname.startsWith("/api/contracts/estimate/")
    || pathname.startsWith("/api/subcontracts/");
}

function applySensitiveBearerHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Content-Security-Policy", "frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const { pathname, search } = request.nextUrl;
  if (isSensitiveBearerPath(pathname)) {
    applySensitiveBearerHeaders(response);
  }

  const { url, publishableKey } = getSupabaseEnv();

  if (!url || !publishableKey) {
    return response;
  }

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const orionApi = isOrionApiPath(pathname);
  const bosAppPath = isAuthorizedBosAppPath(pathname);

  if (!user && (bosAppPath || orionApi)) {
    if (orionApi) {
      return NextResponse.json(
        { ok: false, error: "Authentication is required to use Orion.", statusCategory: "authentication_required" },
        { status: 401 },
      );
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (bosAppPath || orionApi)) {
    const [profileResponse, membershipsResponse] = await Promise.all([
      supabase.from("profiles").select("company_id").eq("id", user.id).maybeSingle(),
      supabase
        .from("company_memberships")
        .select("company_id,role,status,is_primary,permission_overrides")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("is_primary", { ascending: false }),
    ]);

    const activeMemberships = membershipsResponse.data ?? [];
    const membership =
      activeMemberships.find((item) => item.company_id === profileResponse.data?.company_id)
      || activeMemberships.find((item) => item.is_primary)
      || activeMemberships[0]
      || null;

    const overrides = (membership?.permission_overrides ?? null) as PermissionOverrides | null;

    if (orionApi) {
      if (!membership || !canUseOrion(membership.role, overrides)) {
        return NextResponse.json(
          { ok: false, error: "Orion is not available for this B.O.S. account.", statusCategory: "orion_access_denied" },
          { status: 403 },
        );
      }
    }

    if (bosAppPath) {
      // Authorization must happen before the route's server component is rendered.
      // Client-side navigation hiding alone is insufficient because server pages may
      // read company data before AppShell gets a chance to redirect.
      if (!membership) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/app-entry";
        redirectUrl.search = "";
        return NextResponse.redirect(redirectUrl);
      }

      if (!canAccessPath(membership.role, pathname, overrides)) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = getRoleHomePath(membership.role);
        redirectUrl.search = "";
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  if (user && isAuthPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/app-entry";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
