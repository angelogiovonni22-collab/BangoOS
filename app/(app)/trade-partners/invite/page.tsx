import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCompanyAdmin } from "@/lib/supabase/authorization";
import { InviteTradePartnerClient } from "./invite-trade-partner-client";

export default async function InviteTradePartnerPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");

  try {
    await requireCompanyAdmin(supabase);
  } catch {
    redirect("/app-entry");
  }

  return (
    <div className="container-content mx-auto max-w-3xl space-y-5">
      <section className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)]">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8ec3ff]">B.O.S. Trade Partners</p>
        <h1 className="mt-2 text-2xl font-semibold">Invite a Trade Partner</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--bos-text-secondary)]">Create a restricted B.O.S. login for a subcontractor or vendor contact. The account is linked to the selected vendor and remains limited by Trade Partner project assignments and portal security.</p>
      </section>

      <InviteTradePartnerClient />
    </div>
  );
}
