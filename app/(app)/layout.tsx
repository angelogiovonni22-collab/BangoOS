import { redirect } from "next/navigation";
import { AppShell } from "./app-shell";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "first_name" | "last_name" | "company_id"
>;

type CompanyRow = Pick<
  Database["public"]["Tables"]["companies"]["Row"],
  "id" | "name"
>;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  if (!supabase) {
    redirect("/login");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, company_id")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  let company: CompanyRow | null = null;

  if (profile?.company_id) {
    const { data: profileCompany } = await supabase
      .from("companies")
      .select("id, name")
      .eq("id", profile.company_id)
      .maybeSingle<CompanyRow>();

    company = profileCompany ?? null;
  }

  if (!company) {
    const { data: ownerCompany } = await supabase
      .from("companies")
      .select("id, name")
      .eq("owner_id", user.id)
      .maybeSingle<CompanyRow>();

    company = ownerCompany ?? null;
  }

  if (!profile || !company) {
    redirect("/onboarding");
  }

  const userName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || null;

  return (
    <AppShell userName={userName} userEmail={user.email ?? null} companyName={company.name}>
      {children}
    </AppShell>
  );
}
