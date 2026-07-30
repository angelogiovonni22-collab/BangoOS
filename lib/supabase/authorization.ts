import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { resolveWorkspaceContext, type WorkspaceContext } from "@/lib/supabase/workspace";

export const COMPANY_ADMIN_ROLES = ["owner", "administrator"] as const;

export type CompanyRole =
  | "owner"
  | "administrator"
  | "operations_manager"
  | "project_manager"
  | "estimator"
  | "superintendent"
  | "office_manager"
  | "accountant"
  | "foreman"
  | "employee"
  | "subcontractor"
  | "customer";

export type CompanyMembership = {
  id: string;
  company_id: string;
  user_id: string;
  role: CompanyRole;
  status: string;
  is_primary: boolean;
};

export class AuthorizationError extends Error {
  readonly code: "UNAUTHENTICATED" | "NO_COMPANY" | "NOT_MEMBER" | "INSUFFICIENT_ROLE";

  constructor(
    code: "UNAUTHENTICATED" | "NO_COMPANY" | "NOT_MEMBER" | "INSUFFICIENT_ROLE",
    message: string,
  ) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
  }
}

function isAllowedRole(role: string | null, allowedRoles: readonly CompanyRole[]) {
  if (!role) {
    return false;
  }

  return allowedRoles.includes(role as CompanyRole);
}

export async function requireCompany(
  supabase: SupabaseClient<Database> | null,
): Promise<WorkspaceContext> {
  const workspace = await resolveWorkspaceContext(supabase);

  if (workspace.errorCode === "unauthenticated") {
    throw new AuthorizationError("UNAUTHENTICATED", workspace.errorMessage);
  }

  if (!workspace.context) {
    throw new AuthorizationError("NO_COMPANY", workspace.errorMessage);
  }

  return workspace.context;
}

export async function requireCompanyMember(
  supabase: SupabaseClient<Database> | null,
  companyId?: string,
): Promise<CompanyMembership> {
  const workspace = await requireCompany(supabase);

  if (!supabase) {
    throw new AuthorizationError("UNAUTHENTICATED", "Unable to connect right now.");
  }

  const targetCompanyId = companyId || workspace.companyId;

  const { data, error } = await supabase
    .from("company_memberships")
    .select("id, company_id, user_id, role, status, is_primary")
    .eq("company_id", targetCompanyId)
    .eq("user_id", workspace.userId)
    .eq("status", "active")
    .maybeSingle<CompanyMembership>();

  if (error || !data) {
    throw new AuthorizationError("NOT_MEMBER", "You are not an active member of this company.");
  }

  return data;
}

export async function requireCompanyRole(
  supabase: SupabaseClient<Database> | null,
  allowedRoles: readonly CompanyRole[],
  companyId?: string,
): Promise<CompanyMembership> {
  const membership = await requireCompanyMember(supabase, companyId);

  if (!isAllowedRole(membership.role, allowedRoles)) {
    throw new AuthorizationError("INSUFFICIENT_ROLE", "You do not have permission for this action.");
  }

  return membership;
}

export async function requireCompanyAdmin(
  supabase: SupabaseClient<Database> | null,
  companyId?: string,
): Promise<CompanyMembership> {
  return requireCompanyRole(supabase, COMPANY_ADMIN_ROLES, companyId);
}
