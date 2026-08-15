import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { buildExecutiveDashboardData } from "@/lib/dashboard/live-data";
import { hasBosPermission, normalizeCompanyRole } from "@/lib/access-control/permissions";
import type { ExecutiveDashboardData } from "@/lib/dashboard/types";
import { MobileHomeClient, type TradePartnerMobileJob } from "./mobile-home-client";

type TradePartnerRpcClient = {
  rpc: (name: string) => Promise<{ data: TradePartnerMobileJob[] | null; error: { message: string } | null }>;
};

export default async function MobileHomePage() {
  const supabase = await createClient();
  if (!supabase) redirect("/login?next=/mobile-home");

  const [{ data: { user } }, workspace] = await Promise.all([
    supabase.auth.getUser(),
    resolveWorkspaceContext(supabase),
  ]);

  if (!user) redirect("/login?next=/mobile-home");
  if (!workspace.context) redirect("/onboarding");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .maybeSingle<{ first_name: string | null; last_name: string | null }>();

  const role = normalizeCompanyRole(workspace.context.role);
  const userName = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || user.email?.split("@")[0] || "B.O.S. User";

  let dashboardData: ExecutiveDashboardData | null = null;
  if (hasBosPermission(role, "dashboard.view")) {
    try {
      const result = await buildExecutiveDashboardData(supabase, workspace.context);
      dashboardData = result.data;
    } catch {
      dashboardData = null;
    }
  }

  let tradePartnerJobs: TradePartnerMobileJob[] = [];
  if (role === "subcontractor") {
    try {
      const { data } = await (supabase as unknown as TradePartnerRpcClient).rpc("get_my_trade_partner_jobs");
      tradePartnerJobs = data ?? [];
    } catch {
      tradePartnerJobs = [];
    }
  }

  return (
    <MobileHomeClient
      role={role}
      userName={userName}
      dashboardData={dashboardData}
      tradePartnerJobs={tradePartnerJobs}
    />
  );
}
