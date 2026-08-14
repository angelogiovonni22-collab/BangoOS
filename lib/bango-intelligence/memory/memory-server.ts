import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { SupabaseMemoryProvider } from "./supabase-memory-provider";
import { MemoryStore } from "./memory-store";
import type { MemoryActor } from "./memory-types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type MemoryServerContextResult =
  | { ok: true; actor: MemoryActor; store: MemoryStore; supabase: SupabaseClient<Database> }
  | { ok: false; status: number; error: string };

export async function resolveMemoryServerContext(requestId: string): Promise<MemoryServerContextResult> {
  const supabase = await createClient();
  if (!supabase) {
    return { ok: false, status: 503, error: "Service unavailable." };
  }

  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) {
    return { ok: false, status: 401, error: "Authentication required." };
  }

  const membershipsResult = await supabase
    .from("company_memberships")
    .select("role, status")
    .eq("user_id", workspace.context.userId)
    .eq("company_id", workspace.context.companyId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  const companyRole = membershipsResult.data?.role ?? workspace.context.role ?? null;

  const actor: MemoryActor = {
    requestId,
    userId: workspace.context.userId,
    companyId: workspace.context.companyId,
    companyRole,
    allowedCapabilities: [],
  };

  const store = new MemoryStore(new SupabaseMemoryProvider(supabase));

  return { ok: true, actor, store, supabase };
}
