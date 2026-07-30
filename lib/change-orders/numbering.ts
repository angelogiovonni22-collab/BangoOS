import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export async function getNextChangeOrderNumber(
  supabase: SupabaseClient<Database>,
  companyId: string,
) {
  const { data, error } = await supabase.rpc("allocate_change_order_number", {
    p_company_id: companyId,
  });

  if (!error && typeof data === "string" && data.trim().length > 0) {
    return data;
  }

  const year = new Date().getUTCFullYear();
  const { data: rows } = await supabase
    .from("change_orders")
    .select("change_order_number")
    .eq("company_id", companyId)
    .ilike("change_order_number", `CO-${year}-%`)
    .order("created_at", { ascending: false })
    .limit(50);

  const nextSequence = Math.max(
    1,
    ...(rows ?? []).map((row) => {
      const value = row.change_order_number?.trim() || "";
      const match = value.match(new RegExp(`^CO-${year}-(\\d+)$`));
      return match ? Number(match[1]) + 1 : 1;
    }),
  );

  return `CO-${year}-${String(nextSequence).padStart(4, "0")}`;
}
