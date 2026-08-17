import Link from "next/link";
import { requireVendorsAccess } from "@/lib/vendors/server-access";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { VendorsListClient } from "./vendors-list-client";

export default async function VendorsPage() {
  await requireVendorsAccess();

  const supabase = await createClient();
  const workspace = await resolveWorkspaceContext(supabase);
  const role = (workspace.context?.role || "").toLowerCase();
  const canManageTradePartners = role === "owner" || role === "administrator";

  return (
    <div className="space-y-4">
      {canManageTradePartners ? (
        <div className="container-content flex justify-end">
          <Link href="/trade-partners" className="inline-flex h-10 items-center rounded-lg border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] px-4 text-sm font-semibold shadow-[var(--shadow-small)] transition hover:bg-[var(--bos-bg-hover)]">
            Trade Partners Control Center
          </Link>
        </div>
      ) : null}
      <VendorsListClient />
    </div>
  );
}
