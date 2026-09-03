import { redirect } from "next/navigation";
import { getRoleHomePath } from "@/lib/access-control/permissions";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { AppEntryClient } from "./app-entry-client";

export default async function AppEntryPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) redirect("/onboarding");

  return <AppEntryClient desktopPath={getRoleHomePath(workspace.context.role)} />;
}
