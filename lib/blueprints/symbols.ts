import type { SupabaseClient } from "@supabase/supabase-js";
export type BlueprintSymbol = { id: string; key: string; label: string; glyph: string; category: string; custom: boolean };
function table(supabase: SupabaseClient) { return (supabase as unknown as { from: (name: string) => ReturnType<SupabaseClient["from"]> }).from("blueprint_symbol_definitions"); }
export async function loadBlueprintSymbols(supabase: SupabaseClient, companyId: string) {
  const result = await table(supabase).select("id, company_id, category, symbol_key, label, glyph").or(`company_id.is.null,company_id.eq.${companyId}`).order("category").order("label");
  if (result.error) throw result.error;
  return ((result.data ?? []) as Array<Record<string, unknown>>).map((row) => ({ id: String(row.id), key: String(row.symbol_key), label: String(row.label), glyph: String(row.glyph), category: String(row.category), custom: Boolean(row.company_id) } satisfies BlueprintSymbol));
}
