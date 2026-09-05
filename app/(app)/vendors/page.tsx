import { requireVendorsAccess } from "@/lib/vendors/server-access";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { AdaptiveVendorActions } from "./adaptive-vendor-actions";
import { VendorsListClient } from "./vendors-list-client";

export default async function VendorsPage() {
  await requireVendorsAccess();

  const supabase = await createClient();
  const workspace = await resolveWorkspaceContext(supabase);
  const role = (workspace.context?.role || "").toLowerCase();
  const canManageTradePartners = role === "owner" || role === "administrator";

  return (
    <div className="space-y-4">
      <AdaptiveVendorActions canManageTradePartners={canManageTradePartners} />
      <VendorsListClient />
    </div>
  );
}
