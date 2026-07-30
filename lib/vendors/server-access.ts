import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthorizationError, requireCompanyMember } from "@/lib/supabase/authorization";

export async function requireVendorsAccess() {
  const supabase = await createClient();

  if (!supabase) {
    redirect("/login");
  }

  try {
    await requireCompanyMember(supabase);
  } catch (error) {
    if (error instanceof AuthorizationError && error.code === "NO_COMPANY") {
      redirect("/onboarding");
    }

    redirect("/login");
  }
}
