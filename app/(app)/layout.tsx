import { redirect } from "next/navigation";
import { AppShell } from "./app-shell";
import { CompanyProvider } from "@/lib/company";
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

  return (
    <CompanyProvider workspace={workspace.context}>
      <AppShell
        userName={userName}
        userEmail={user.email ?? null}
        companyName={workspace.context.companyName}
      >
        {children}
      </AppShell>
    </CompanyProvider>
  );
}
