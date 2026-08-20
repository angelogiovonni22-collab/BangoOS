import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { hasBosPermission, type BosPermission, type PermissionOverrides } from "@/lib/access-control/permissions";
import type { OrionCommandDefinition } from "./types";

const COMMAND_PERMISSIONS: Record<string, readonly BosPermission[]> = {
  "customer.open": ["customers.view"],
  "customer.create": ["customers.manage"],
  "customer.update": ["customers.manage"],
  "customer.archive": ["customers.manage"],
  "customer.restore": ["customers.manage"],

  "estimate.open": ["estimates.view"],
  "estimate.create": ["estimates.manage"],
  "estimate.send": ["estimates.manage"],
  "estimate.approve": ["estimates.manage"],
  "estimate.decline": ["estimates.manage"],
  "estimate.convert": ["estimates.manage", "projects.manage"],
  "estimate.generate_deposit_invoice": ["estimates.view", "invoices.manage"],

  "project.open": ["projects.view"],
  "project.create": ["projects.manage"],
  "project.update_status": ["projects.manage"],
  "project.assign_crew": ["projects.manage", "workforce.manage"],
  "project.complete": ["projects.manage"],
  "project.archive": ["projects.manage"],

  "schedule.open": ["schedule.view"],
  "schedule.read_range": ["schedule.view"],

  "invoice.open": ["invoices.view"],
  "invoice.create": ["invoices.manage"],
  "invoice.send": ["invoices.manage"],
  "invoice.record_payment": ["invoices.manage"],
  "invoice.record_deposit": ["invoices.manage"],
  "invoice.issue_refund": ["invoices.manage"],

  "employee.open": ["workforce.view"],
  "employee.create": ["workforce.manage"],
  "employee.assign": ["workforce.manage"],
  "employee.archive": ["workforce.manage"],
  "crew.open": ["workforce.view"],
  "crew.create": ["workforce.manage"],
  "crew.assign": ["workforce.manage"],
  "crew.remove": ["workforce.manage"],
};

type LiveMembership = {
  role: string;
  permission_overrides: PermissionOverrides | null;
};

export type OrionCommandAuthorizationResult =
  | { allowed: true; role: string; overrides: PermissionOverrides | null; semanticPermissions: readonly BosPermission[] | null }
  | { allowed: false; reason: string; role: string | null; semanticPermissions: readonly BosPermission[] | null };

export async function authorizeOrionCommand(input: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  userId: string | null;
  command: OrionCommandDefinition;
  legacyRoleAllowed: (role: string) => boolean;
}): Promise<OrionCommandAuthorizationResult> {
  const semanticPermissions = COMMAND_PERMISSIONS[input.command.id] || null;
  if (!input.userId) {
    return { allowed: false, reason: "An active user identity is required for this Orion command.", role: null, semanticPermissions };
  }

  const { data, error } = await input.supabase
    .from("company_memberships")
    .select("role,permission_overrides")
    .eq("company_id", input.companyId)
    .eq("user_id", input.userId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) {
    return { allowed: false, reason: "An active company membership is required for this Orion command.", role: null, semanticPermissions };
  }

  const membership = data as unknown as LiveMembership;
  const overrides = membership.permission_overrides || null;

  if (semanticPermissions) {
    const allowed = semanticPermissions.every((permission) => hasBosPermission(membership.role, permission, overrides));
    return allowed
      ? { allowed: true, role: membership.role, overrides, semanticPermissions }
      : { allowed: false, reason: `Permission denied for ${input.command.id}.`, role: membership.role, semanticPermissions };
  }

  if (!input.legacyRoleAllowed(membership.role)) {
    return { allowed: false, reason: `Permission denied for ${input.command.id}.`, role: membership.role, semanticPermissions };
  }

  return { allowed: true, role: membership.role, overrides, semanticPermissions };
}
