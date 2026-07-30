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

  const activeMembership =
    activeMemberships.find((membership) => membership.company_id === profile.company_id)
    || activeMemberships.find((membership) => membership.is_primary)
    || activeMemberships[0]
    || null;

  let companyId = activeMembership?.company_id ?? profile.company_id;
  let role = activeMembership?.role ?? profile.role;
  let membershipId = activeMembership?.id ?? null;
  let membershipStatus = activeMembership?.status ?? null;

  if (!companyId) {
    const { data: ownerCompany, error: ownerCompanyError } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle<{ id: string }>();

    if (ownerCompanyError) {
      return {
        context: null,
        errorMessage:
          "Unable to verify your workspace right now. Please try again shortly.",
        errorCode: "company_unavailable",
      };
    }

    if (ownerCompany?.id) {
      const { error: patchProfileError } = await supabase
        .from("profiles")
        .update({ company_id: ownerCompany.id })
        .eq("id", user.id);

      if (!patchProfileError) {
        companyId = ownerCompany.id;

        if (hasMembershipsTable) {
          const { data: ownerMembership } = await supabase
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
            .select("id, status, role")
            .maybeSingle();

          if (ownerMembership) {
            membershipId = ownerMembership.id;
            membershipStatus = ownerMembership.status;
            role = ownerMembership.role;
          }
        }
      }
    }
  }

  if (!companyId) {
    return {
      context: null,
      errorMessage: "No company was found for your account yet.",
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
      errorMessage:
        "Unable to verify your workspace right now. Please try again shortly.",
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

  if (hasMembershipsTable && !membershipId) {
    const { data: createdMembership } = await supabase
      .from("company_memberships")
      .upsert(
        {
          company_id: company.id,
          user_id: user.id,
          role: role || "employee",
          status: "active",
          is_primary: true,
        },
        { onConflict: "company_id,user_id" },
      )
      .select("id, status, role")
      .maybeSingle();

    if (createdMembership) {
      membershipId = createdMembership.id;
      membershipStatus = createdMembership.status;
      role = createdMembership.role;
    }
  }

  if (
    profile.company_id !== company.id
    || (role && profile.role !== role)
  ) {
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