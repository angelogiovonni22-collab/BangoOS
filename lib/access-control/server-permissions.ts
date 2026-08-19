import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { WorkspaceContext } from "@/lib/supabase/workspace";
import {
  canUseOrion,
  hasBosPermission,
  type BosPermission,
  type PermissionOverrides,
} from "./permissions";

function normalizeOverrides(value: unknown): PermissionOverrides | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const normalized: PermissionOverrides = {};
  for (const [key, entry] of Object.entries(source)) {
    if (typeof entry === "boolean") {
      (normalized as Record<string, boolean>)[key] = entry;
    }
  }
  return normalized;
}

export async function loadWorkspacePermissionOverrides(
  supabase: SupabaseClient<Database>,
  workspace: WorkspaceContext,
): Promise<PermissionOverrides | null> {
  if (!workspace.membershipId) return null;

  const { data, error } = await supabase
    .from("company_memberships")
    .select("permission_overrides")
    .eq("id", workspace.membershipId)
    .eq("company_id", workspace.companyId)
    .eq("user_id", workspace.userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to verify workspace permissions.");
  }

  const row = data as unknown as { permission_overrides?: unknown } | null;
  return normalizeOverrides(row?.permission_overrides);
}

export async function hasWorkspacePermission(
  supabase: SupabaseClient<Database>,
  workspace: WorkspaceContext,
  permission: BosPermission,
) {
  const overrides = await loadWorkspacePermissionOverrides(supabase, workspace);
  return hasBosPermission(workspace.role, permission, overrides);
}

export async function canWorkspaceUseOrion(
  supabase: SupabaseClient<Database>,
  workspace: WorkspaceContext,
) {
  const overrides = await loadWorkspacePermissionOverrides(supabase, workspace);
  return canUseOrion(workspace.role, overrides);
}
