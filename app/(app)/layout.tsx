import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppShell } from "./app-shell";
import { CompanyProvider } from "@/lib/company";
import { canUseOrion, type PermissionOverrides } from "@/lib/access-control/permissions";
import { AdaptiveBosProvider } from "@/lib/adaptive-bos/provider";
import { type AdaptiveBosCompanyProfile } from "@/lib/adaptive-bos/config";
import { resolveAdaptiveBosConfigFromDatabase } from "@/lib/adaptive-bos/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

// Adaptive B.O.S. tables are migration-backed until generated database types are refreshed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdaptiveSupabase = SupabaseClient<any>;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  if (!supabase) {
    redirect("/login");
  }

  const [
    {
      data: { user },
    },
    workspace,
  ] = await Promise.all([
    supabase.auth.getUser(),
    resolveWorkspaceContext(supabase),
  ]);

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .eq("id", user.id)
    .maybeSingle<{ id: string; first_name: string | null; last_name: string | null }>();

  if (!profile || !workspace.context) {
    redirect("/onboarding");
  }

  const userName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || null;
  let permissionOverrides: PermissionOverrides | null = null;

  if (workspace.context.membershipId) {
    const { data: permissionRow } = await supabase
      .from("company_memberships")
      .select("permission_overrides")
      .eq("id", workspace.context.membershipId)
      .eq("company_id", workspace.context.companyId)
      .maybeSingle();
    const typedPermissionRow = permissionRow as unknown as { permission_overrides: PermissionOverrides | null } | null;
    permissionOverrides = typedPermissionRow?.permission_overrides ?? null;
  }

  const adaptiveDb = supabase as unknown as AdaptiveSupabase;
  const { data: operatingProfileRow } = await adaptiveDb
    .from("company_operating_profiles")
    .select("industry_key,industry_label,business_model,primary_services,module_overrides,terminology_overrides,workflow_overrides")
    .eq("company_id", workspace.context.companyId)
    .maybeSingle();
  const operatingProfile: AdaptiveBosCompanyProfile = operatingProfileRow ? {
    industryKey: operatingProfileRow.industry_key,
    industryLabel: operatingProfileRow.industry_label,
    businessModel: operatingProfileRow.business_model,
    primaryServices: operatingProfileRow.primary_services,
    moduleOverrides: operatingProfileRow.module_overrides,
    terminologyOverrides: operatingProfileRow.terminology_overrides,
    workflowOverrides: operatingProfileRow.workflow_overrides,
  } : { industryKey: "construction", industryLabel: "Construction" };
  const adaptiveConfig = await resolveAdaptiveBosConfigFromDatabase(supabase, operatingProfile);

  const orionEnabled = canUseOrion(workspace.context.role, permissionOverrides);
  const { data: platformAdministrator } = await supabase
    .from("bos_platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  return (
    <CompanyProvider workspace={workspace.context}>
      <AdaptiveBosProvider config={adaptiveConfig}>
        <AppShell
          userName={userName}
          userEmail={user.email ?? null}
          companyName={workspace.context.companyName}
          role={workspace.context.role}
          orionEnabled={orionEnabled}
          platformAdmin={Boolean(platformAdministrator)}
        >
          {children}
        </AppShell>
      </AdaptiveBosProvider>
    </CompanyProvider>
  );
}
