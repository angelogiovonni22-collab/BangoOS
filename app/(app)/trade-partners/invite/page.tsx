import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCompanyAdmin } from "@/lib/supabase/authorization";
import { InviteTradePartnerClient } from "./invite-trade-partner-client";

export default async function InviteTradePartnerPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");

  let membership;
  try {
    membership = await requireCompanyAdmin(supabase);
  } catch {
    redirect("/app-entry");
  }

  const { data, error } = await supabase
    .from("vendors")
    .select("id,display_name,company_name,status")
    .eq("company_id", membership.company_id)
    .neq("status", "inactive")
    .order("display_name");

  const vendors = (data ?? []).map((vendor) => ({
    id: vendor.id,
    name: vendor.display_name || vendor.company_name,
  }));

  return (
    <div className="container-content mx-auto max-w-3xl space-y-5">
      <section className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)]">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8ec3ff]">B.O.S. Trade Partners</p>
        <h1 className="mt-2 text-2xl font-semibold">Invite a Trade Partner</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--bos-text-secondary)]">Create a restricted B.O.S. login for a subcontractor or vendor contact. The account is linked to the selected vendor and remains limited by Trade Partner project assignments and portal security.</p>
      </section>

      {error ? <div className="rounded-xl border border-red-300/40 bg-red-50 p-4 text-sm text-red-900">Unable to load vendors: {error.message}</div> : <InviteTradePartnerClient vendors={vendors} />}
    </div>
  );
}
