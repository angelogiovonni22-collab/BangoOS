import { redirect } from "next/navigation";
import { AppShell } from "./app-shell";
import { CompanyProvider } from "@/lib/company";
import { canUseOrion, type PermissionOverrides } from "@/lib/access-control/permissions";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

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

  const orionEnabled = canUseOrion(workspace.context.role, permissionOverrides);
  const { data: platformAdministrator } = await supabase
    .from("bos_platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  return (
    <CompanyProvider workspace={workspace.context}>
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
    </CompanyProvider>
  );
}
