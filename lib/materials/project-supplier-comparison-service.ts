import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { compareSupplierPrices, effectiveSupplierUnitCost, type SupplierPriceComparison, type SupplierPriceOption } from "./supplier-price-comparison";

type QueryableSupabase = NonNullable<ReturnType<typeof createClient>> & {
  // Generated database types intentionally trail supplier pricing migrations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

type PlanRow = { id: string; material_id: string | null; selected_supplier_price_entry_id: string | null };
type EntryRow = { id: string; price_list_id: string; vendor_id: string; material_id: string | null; supplier_sku: string; product_description: string; unit_of_measure: string; unit_price: number; contractor_price: number | null; availability: string | null };
type ListRow = { id: string; list_name: string; branch_name: string | null; effective_on: string; verified_on: string; status: string; expires_on: string | null };

type SupplierComparisonPayload = {
  byPlanItemId: Record<string, SupplierPriceComparison>;
};

export class ProjectSupplierComparisonError extends Error {}

export function createProjectSupplierComparisonService(client = createClient()) {
  if (!client) throw new ProjectSupplierComparisonError("Unable to connect to storage.");
  const supabase = client as QueryableSupabase;

  async function context() {
    const result = await resolveWorkspaceContext(client);
    if (!result.context) throw new ProjectSupplierComparisonError(result.errorMessage || "Unable to resolve workspace.");
    return result.context;
  }

  async function load(projectId: string): Promise<SupplierComparisonPayload> {
    const workspace = await context();
    const [plans, vendors, lists] = await Promise.all([
      supabase.from("project_material_plan_items").select("id, material_id, selected_supplier_price_entry_id").eq("company_id", workspace.companyId).eq("project_id", projectId).neq("status", "cancelled"),
      supabase.from("vendors").select("id, display_name").eq("company_id", workspace.companyId),
      supabase.from("supplier_price_lists").select("id, list_name, branch_name, effective_on, verified_on, status, expires_on").eq("company_id", workspace.companyId).eq("status", "active"),
    ]);
    const firstError = plans.error || vendors.error || lists.error;
    if (firstError) throw new ProjectSupplierComparisonError(firstError.message);

    const materialIds = [...new Set(((plans.data ?? []) as PlanRow[]).map((row) => row.material_id).filter(Boolean))] as string[];
    const entries = materialIds.length
      ? await supabase.from("supplier_price_entries").select("id, price_list_id, vendor_id, material_id, supplier_sku, product_description, unit_of_measure, unit_price, contractor_price, availability").eq("company_id", workspace.companyId).in("material_id", materialIds).eq("match_status", "confirmed")
      : { data: [], error: null };
    if (entries.error) throw new ProjectSupplierComparisonError(entries.error.message);

    const vendorNames = new Map((vendors.data ?? []).map((row: { id: string; display_name: string }) => [row.id, row.display_name]));
    const listRows = new Map(((lists.data ?? []) as ListRow[]).map((row) => [row.id, row]));
    const today = new Date().toISOString().slice(0, 10);
    const byMaterial = new Map<string, SupplierPriceOption[]>();
    for (const entry of (entries.data ?? []) as EntryRow[]) {
      if (!entry.material_id) continue;
      const list = listRows.get(entry.price_list_id);
      if (!list || list.effective_on > today || (list.expires_on && list.expires_on < today)) continue;
      const option: SupplierPriceOption = {
        entryId: entry.id,
        vendorId: entry.vendor_id,
        vendorName: vendorNames.get(entry.vendor_id) || "Supplier",
        supplierSku: entry.supplier_sku,
        description: entry.product_description,
        unitOfMeasure: entry.unit_of_measure,
        effectiveUnitCost: effectiveSupplierUnitCost(Number(entry.unit_price), entry.contractor_price === null ? null : Number(entry.contractor_price)),
        listName: list.list_name,
        branchName: list.branch_name,
        effectiveOn: list.effective_on,
        verifiedOn: list.verified_on,
        availability: entry.availability,
      };
      byMaterial.set(entry.material_id, [...(byMaterial.get(entry.material_id) ?? []), option]);
    }

    return {
      byPlanItemId: Object.fromEntries(((plans.data ?? []) as PlanRow[]).map((row) => [row.id, compareSupplierPrices(row.material_id ? byMaterial.get(row.material_id) ?? [] : [], row.selected_supplier_price_entry_id)])),
    };
  }

  async function select(projectId: string, planItemId: string, entryId: string) {
    const workspace = await context();
    const { data: entry, error: entryError } = await supabase.from("supplier_price_entries").select("id, price_list_id, vendor_id, material_id, unit_price, contractor_price, match_status").eq("company_id", workspace.companyId).eq("id", entryId).eq("match_status", "confirmed").maybeSingle();
    if (entryError) throw new ProjectSupplierComparisonError(entryError.message);
    if (!entry) throw new ProjectSupplierComparisonError("The selected supplier price is not available.");

    const { data: list, error: listError } = await supabase.from("supplier_price_lists").select("id, status, effective_on, expires_on").eq("company_id", workspace.companyId).eq("id", entry.price_list_id).eq("status", "active").maybeSingle();
    if (listError) throw new ProjectSupplierComparisonError(listError.message);
    const today = new Date().toISOString().slice(0, 10);
    if (!list || list.effective_on > today || (list.expires_on && list.expires_on < today)) throw new ProjectSupplierComparisonError("The selected supplier price list is not currently active.");

    const { data: plan, error: planError } = await supabase.from("project_material_plan_items").select("id, material_id").eq("company_id", workspace.companyId).eq("project_id", projectId).eq("id", planItemId).maybeSingle();
    if (planError) throw new ProjectSupplierComparisonError(planError.message);
    if (!plan || !plan.material_id || plan.material_id !== entry.material_id) throw new ProjectSupplierComparisonError("Supplier price does not match this project material.");

    const unitCost = effectiveSupplierUnitCost(Number(entry.unit_price), entry.contractor_price === null ? null : Number(entry.contractor_price));
    const { error } = await supabase.from("project_material_plan_items").update({ selected_vendor_id: entry.vendor_id, selected_supplier_price_entry_id: entry.id, current_unit_cost: unitCost, status: "ready_to_order", updated_by: workspace.userId, updated_at: new Date().toISOString() }).eq("company_id", workspace.companyId).eq("project_id", projectId).eq("id", planItemId);
    if (error) throw new ProjectSupplierComparisonError(error.message);
    return { unitCost, vendorId: entry.vendor_id };
  }

  return { load, select };
}
