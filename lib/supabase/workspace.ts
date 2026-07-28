import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type WorkspaceContext = {
  userId: string;
  companyId: string;
  role: string | null;
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

  let companyId = profile.company_id;

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
    .select("id")
    .eq("id", companyId)
    .maybeSingle();

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

  return {
    context: {
      userId: user.id,
      companyId: company.id,
      role: profile.role,
    },
    errorMessage: null,
    errorCode: null,
  };
}