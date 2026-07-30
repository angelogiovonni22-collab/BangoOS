import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export async function getNextEstimateNumber(
  supabase: SupabaseClient<Database>,
  companyId: string,
) {
  const year = new Date().getUTCFullYear();
  const { data } = await supabase
    .from("estimates")
    .select("estimate_number")
    .eq("company_id", companyId)
    .ilike("estimate_number", `EST-${year}-%`)
    .order("created_at", { ascending: false })
    .limit(50);

  const nextSequence = Math.max(
    1,
    ...(data ?? []).map((row) => {
      const value = row.estimate_number?.trim() || "";
      const match = value.match(new RegExp(`^EST-${year}-(\\d+)$`));
      return match ? Number(match[1]) + 1 : 1;
    }),
  );

  return `EST-${year}-${String(nextSequence).padStart(4, "0")}`;
}
