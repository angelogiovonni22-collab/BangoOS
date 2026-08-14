import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type EstimateConversionDraft = {
  estimateId: string;
  customerId: string | null;
  projectId: string | null;
  title: string;
  sourceEstimateNumber: string | null;
  issueDate: string | null;
  suggestedLineItems: Array<{
    description: string;
    quantity: number;
    unit: string;
    rate: number;
  }>;
};

export async function createEstimateConversionDraft(
  supabase: SupabaseClient<Database>,
  companyId: string,
  estimateId: string,
): Promise<{ error: string | null; data: EstimateConversionDraft | null }> {
  const [estimateResponse, lineItemsResponse] = await Promise.all([
    supabase
      .from("estimates")
      .select("id, customer_id, project_id, estimate_number, title, issue_date, status")
      .eq("company_id", companyId)
      .eq("id", estimateId)
      .maybeSingle(),
    supabase
      .from("estimate_line_items")
      .select("description, quantity, unit, unit_price")
      .eq("company_id", companyId)
      .eq("estimate_id", estimateId)
      .order("sort_order", { ascending: true }),
  ]);

  if (estimateResponse.error) {
    return { error: estimateResponse.error.message, data: null };
  }

  if (!estimateResponse.data) {
    return { error: "Estimate not found.", data: null };
  }

  if (lineItemsResponse.error) {
    return { error: lineItemsResponse.error.message, data: null };
  }

  return {
    error: null,
    data: {
      estimateId: estimateResponse.data.id,
      customerId: estimateResponse.data.customer_id,
      projectId: estimateResponse.data.project_id,
      title: estimateResponse.data.title,
      sourceEstimateNumber: estimateResponse.data.estimate_number,
      issueDate: estimateResponse.data.issue_date,
      suggestedLineItems: (lineItemsResponse.data ?? []).map((item) => ({
        description: item.description,
        quantity: Number(item.quantity ?? 0),
        unit: item.unit,
        rate: Number(item.unit_price ?? 0),
      })),
    },
  };
}
