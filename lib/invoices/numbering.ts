import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export async function getNextInvoiceNumber(
  supabase: SupabaseClient<Database>,
  companyId: string,
) {
  const year = new Date().getUTCFullYear();
  const { data } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("company_id", companyId)
    .ilike("invoice_number", `INV-${year}-%`)
    .order("created_at", { ascending: false })
    .limit(50);

  const nextSequence = Math.max(
    1,
    ...(data ?? []).map((row) => {
      const value = row.invoice_number?.trim() || "";
      const match = value.match(new RegExp(`^INV-${year}-(\\d+)$`));
      return match ? Number(match[1]) + 1 : 1;
    }),
  );

  return `INV-${year}-${String(nextSequence).padStart(4, "0")}`;
}
