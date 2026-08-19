import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// Keep the estimate-first acquisition workflow isolated from generated database types
// until the new migration has been applied and types are regenerated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

export type EstimateProspectValues = {
  customerType: "residential" | "commercial";
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  notes: string;
};

export type EstimateProspectErrors = Partial<Record<keyof EstimateProspectValues, string>>;

export const EMPTY_ESTIMATE_PROSPECT: EstimateProspectValues = {
  customerType: "residential",
  firstName: "",
  lastName: "",
  companyName: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  notes: "",
};

function clean(value: string | null | undefined) {
  return (value || "").trim();
}

export function validateEstimateProspect(values: EstimateProspectValues): EstimateProspectErrors {
  const errors: EstimateProspectErrors = {};
  if (!clean(values.firstName)) errors.firstName = "First name is required.";
  if (!clean(values.lastName)) errors.lastName = "Last name is required.";
  if (!clean(values.email)) errors.email = "Email is required.";
  if (!clean(values.phone)) errors.phone = "Phone is required.";
  if (!clean(values.addressLine1)) errors.addressLine1 = "Job / customer address is required.";
  if (!clean(values.city)) errors.city = "City is required.";
  if (!clean(values.state)) errors.state = "State is required.";
  if (!clean(values.postalCode)) errors.postalCode = "ZIP / postal code is required.";
  return errors;
}

export async function loadEstimateProspect(
  supabase: SupabaseClient<Database>,
  companyId: string,
  estimateId: string,
): Promise<{ error: string | null; data: EstimateProspectValues | null }> {
  const db = supabase as unknown as AnySupabase;
  const { data, error } = await db
    .from("estimate_prospects")
    .select("customer_type,first_name,last_name,company_name,email,phone,address_line_1,address_line_2,city,state,postal_code,notes")
    .eq("company_id", companyId)
    .eq("estimate_id", estimateId)
    .maybeSingle();

  if (error) return { error: error.message || "Unable to load prospect details.", data: null };
  if (!data) return { error: null, data: null };

  return {
    error: null,
    data: {
      customerType: data.customer_type === "commercial" ? "commercial" : "residential",
      firstName: data.first_name || "",
      lastName: data.last_name || "",
      companyName: data.company_name || "",
      email: data.email || "",
      phone: data.phone || "",
      addressLine1: data.address_line_1 || "",
      addressLine2: data.address_line_2 || "",
      city: data.city || "",
      state: data.state || "",
      postalCode: data.postal_code || "",
      notes: data.notes || "",
    },
  };
}

export async function saveEstimateProspect(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  estimateId: string;
  userId: string;
  values: EstimateProspectValues;
}) {
  const validation = validateEstimateProspect(params.values);
  if (Object.keys(validation).length > 0) {
    return { error: "Complete the prospective customer details before saving." };
  }

  const db = params.supabase as unknown as AnySupabase;
  const { error } = await db.from("estimate_prospects").upsert({
    company_id: params.companyId,
    estimate_id: params.estimateId,
    customer_type: params.values.customerType,
    first_name: clean(params.values.firstName),
    last_name: clean(params.values.lastName),
    company_name: clean(params.values.companyName) || null,
    email: clean(params.values.email),
    phone: clean(params.values.phone),
    address_line_1: clean(params.values.addressLine1),
    address_line_2: clean(params.values.addressLine2) || null,
    city: clean(params.values.city),
    state: clean(params.values.state),
    postal_code: clean(params.values.postalCode),
    notes: clean(params.values.notes) || null,
    created_by: params.userId,
    updated_by: params.userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "company_id,estimate_id" });

  return { error: error?.message || null };
}

export async function removeEstimateProspect(
  supabase: SupabaseClient<Database>,
  companyId: string,
  estimateId: string,
) {
  const db = supabase as unknown as AnySupabase;
  const { error } = await db
    .from("estimate_prospects")
    .delete()
    .eq("company_id", companyId)
    .eq("estimate_id", estimateId);
  return { error: error?.message || null };
}
