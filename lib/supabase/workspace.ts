import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type WorkspaceContext = {
  userId: string;
  companyId: string;
};

export type WorkspaceResolutionResult =
  | {
      context: WorkspaceContext;
      errorMessage: null;
    }
  | {
      context: null;
      errorMessage: string;
    };

export async function resolveWorkspaceContext(
  supabase: SupabaseClient<Database> | null,
): Promise<WorkspaceResolutionResult> {
  if (!supabase) {
    return {
      context: null,
      errorMessage: "Unable to connect right now. Please try again shortly.",
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
    };
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (companyError) {
    return {
      context: null,
      errorMessage:
        "Unable to verify your workspace right now. Please try again shortly.",
    };
  }

  if (!company) {
    return {
      context: null,
      errorMessage: "No company was found for your account yet.",
    };
  }

  return {
    context: {
      userId: user.id,
      companyId: company.id,
    },
    errorMessage: null,
  };
}