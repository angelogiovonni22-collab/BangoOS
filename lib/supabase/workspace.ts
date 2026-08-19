import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type WorkspaceContext = {
  userId: string;
  companyId: string;
  role: string | null;
  companyName: string | null;
  companySlug: string | null;
  membershipId: string | null;
  membershipStatus: string | null;
};

export type WorkspaceErrorCode =
  | "supabase_unavailable"
  | "unauthenticated"
  | "profile_missing"
  | "company_missing"
  | "company_unavailable"
  | "unknown";

export type WorkspaceResolutionResult =
  | {
      context: WorkspaceContext;
      errorMessage: null;
      errorCode: null;
    }
  | {
      context: null;
      errorMessage: string;
      errorCode: WorkspaceErrorCode;
    };

export async function resolveWorkspaceContext(
  supabase: SupabaseClient<Database> | null,
): Promise<WorkspaceResolutionResult> {
  if (!supabase) {
    return {
      context: null,
      errorMessage: "Unable to connect right now. Please try again shortly.",
      errorCode: "supabase_unavailable",
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      context: null,
      errorMessage: "You need to be logged in to continue.",
      errorCode: "unauthenticated",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, company_id, role")
    .eq("id", user.id)
    .maybeSingle<{
      id: string;
      company_id: string | null;
      role: string | null;
    }>();

  if (profileError) {
    return {
      context: null,
      errorMessage:
        "Unable to verify your workspace right now. Please try again shortly.",
      errorCode: "company_unavailable",
    };
  }

  if (!profile) {
    return {
      context: null,
      errorMessage: "Your account profile is not set up yet.",
      errorCode: "profile_missing",
    };
  }

  const { data: memberships, error: membershipsError } = await supabase
    .from("company_memberships")
    .select("id, company_id, role, status, is_primary, joined_at, created_at")
    .eq("user_id", user.id)
    .order("is_primary", { ascending: false })
    .order("joined_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  const hasMembershipsTable = !membershipsError;
  const activeMemberships = (memberships ?? []).filter((membership) => membership.status === "active");
  let activeMembership =
    activeMemberships.find((membership) => membership.company_id === profile.company_id)
    || activeMemberships.find((membership) => membership.is_primary)
    || activeMemberships[0]
    || null;

  // Once company_memberships exists, it is the authorization source of truth.
  // Never recreate or reactivate a missing/suspended membership from the legacy
  // profile row. The only safe bootstrap is the actual companies.owner_id owner.
  if (hasMembershipsTable && !activeMembership) {
    const { data: ownerCompany, error: ownerCompanyError } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle<{ id: string }>();

    if (ownerCompanyError) {
      return {
        context: null,
        errorMessage: "Unable to verify your workspace right now. Please try again shortly.",
        errorCode: "company_unavailable",
      };
    }

    if (!ownerCompany?.id) {
      return {
        context: null,
        errorMessage: "Your company access is not active. Contact a company administrator.",
        errorCode: "company_unavailable",
      };
    }

    const { data: ownerMembership, error: ownerMembershipError } = await supabase
      .from("company_memberships")
      .upsert(
        {
          company_id: ownerCompany.id,
          user_id: user.id,
          role: "owner",
          status: "active",
          is_primary: true,
        },
        { onConflict: "company_id,user_id" },
      )
      .select("id, company_id, role, status, is_primary, joined_at, created_at")
      .maybeSingle();

    if (ownerMembershipError || !ownerMembership) {
      return {
        context: null,
        errorMessage: "Unable to restore the company owner workspace.",
        errorCode: "company_unavailable",
      };
    }

    activeMembership = ownerMembership;
  }

  let companyId = hasMembershipsTable ? activeMembership?.company_id ?? null : profile.company_id;
  let role = hasMembershipsTable ? activeMembership?.role ?? null : profile.role;
  const membershipId = activeMembership?.id ?? null;
  const membershipStatus = activeMembership?.status ?? null;

  // Legacy fallback is retained only for installations where the memberships
  // table genuinely does not exist. It must never override an inactive membership.
  if (!companyId && !hasMembershipsTable) {
    const { data: ownerCompany, error: ownerCompanyError } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle<{ id: string }>();

    if (ownerCompanyError) {
      return {
        context: null,
        errorMessage: "Unable to verify your workspace right now. Please try again shortly.",
        errorCode: "company_unavailable",
      };
    }

    if (ownerCompany?.id) {
      companyId = ownerCompany.id;
      role = "owner";
    }
  }

  if (!companyId) {
    return {
      context: null,
      errorMessage: "No active company was found for your account.",
      errorCode: "company_missing",
    };
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .maybeSingle<{
      id: string;
      name: string | null;
    }>();

  if (companyError) {
    return {
      context: null,
      errorMessage: "Unable to verify your workspace right now. Please try again shortly.",
      errorCode: "company_unavailable",
    };
  }

  if (!company) {
    return {
      context: null,
      errorMessage: "No company was found for your account yet.",
      errorCode: "company_missing",
    };
  }

  if (profile.company_id !== company.id || (role && profile.role !== role)) {
    await supabase
      .from("profiles")
      .update({
        company_id: company.id,
        role: role ?? profile.role ?? "employee",
      })
      .eq("id", user.id);
  }

  return {
    context: {
      userId: user.id,
      companyId: company.id,
      role,
      companyName: company.name || null,
      companySlug: null,
      membershipId,
      membershipStatus,
    },
    errorMessage: null,
    errorCode: null,
  };
}
