import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

export async function requireBillingAdministrator(supabase: SupabaseClient<Database>) {
  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) throw new Error(workspace.errorMessage || "Your B.O.S. workspace is unavailable.");
  if (!workspace.context.role || !(["owner", "administrator"] as string[]).includes(workspace.context.role)) throw new Error("Only a company owner or administrator can manage billing.");
  return workspace.context;
}
