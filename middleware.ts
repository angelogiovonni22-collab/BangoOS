import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canUseOrion, type PermissionOverrides } from "@/lib/access-control/permissions";
import { getSupabaseEnv } from "@/lib/supabase/env";

const PROTECTED_PATHS = [
  "/dashboard",
  "/customers",
  "/vendors",
  "/projects",
  "/estimates",
  "/team",
  "/schedule",
  "/invoices",
  "/settings",
  "/onboarding",
];

const AUTH_PATHS = ["/login", "/signup"];

function isProtectedPath(pathname: string) {
  return PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isAuthPath(pathname: string) {
  return AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isOrionApiPath(pathname: string) {
  return pathname === "/api/orion" || pathname.startsWith("/api/orion/");
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

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

  const { pathname, search } = request.nextUrl;

  if (isOrionApiPath(pathname)) {
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Authentication is required to use Orion.", statusCategory: "authentication_required" },
        { status: 401 },
      );
    }

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
    if (!membership || !canUseOrion(membership.role, overrides)) {
      return NextResponse.json(
        { ok: false, error: "Orion is not available for this B.O.S. account.", statusCategory: "orion_access_denied" },
        { status: 403 },
      );
    }
  }

  if (!user && isProtectedPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAuthPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
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
