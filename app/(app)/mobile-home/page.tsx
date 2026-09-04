import { redirect } from "next/navigation";
import { getRoleHomePath } from "@/lib/access-control/permissions";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

export default async function MobileHomePage() {
  const supabase = await createClient();
  if (!supabase) redirect("/login?next=/app-entry");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app-entry");

  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) redirect("/onboarding");

  redirect(getRoleHomePath(workspace.context.role));
}
