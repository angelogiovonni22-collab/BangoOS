import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

export type LearningTaskRow = Pick<
  Database["public"]["Tables"]["tasks"]["Row"],
  | "id"
  | "company_id"
  | "project_id"
  | "assigned_profile_id"
  | "status"
  | "completion_percentage"
  | "estimated_hours"
  | "actual_hours"
  | "created_at"
  | "updated_at"
>;

export type LearningProjectRow = Pick<
  Database["public"]["Tables"]["projects"]["Row"],
  | "id"
  | "company_id"
  | "name"
  | "project_type"
  | "status"
  | "contract_amount"
  | "estimated_cost"
  | "estimated_start_date"
  | "estimated_end_date"
  | "actual_start_date"
  | "actual_end_date"
  | "customer_id"
  | "created_at"
  | "updated_at"
>;

export type LearningChangeOrderRow = Pick<
  Database["public"]["Tables"]["change_orders"]["Row"],
  "id" | "company_id" | "project_id" | "status" | "total_amount" | "created_at"
>;

export type LearningEstimateRow = Pick<
  Database["public"]["Tables"]["estimates"]["Row"],
  "id" | "company_id" | "project_id" | "total_amount" | "status" | "created_at"
>;

export type LearningInvoiceRow = Pick<
  Database["public"]["Tables"]["invoices"]["Row"],
  "id" | "company_id" | "project_id" | "total_amount" | "amount_paid" | "status" | "created_at"
>;

export type LearningMemoryRow = {
  id: string;
  company_id: string;
  project_id: string | null;
  customer_id: string | null;
  related_task_id: string | null;
  phase: string | null;
  category: string;
  content: string;
  source: string;
  relevance_score: number;
  recommendation_status: string | null;
  recommendation_outcome: string | null;
  verification_status: string;
  linked_vendor_id: string | null;
  linked_equipment_id: string | null;
  linked_material_id: string | null;
  created_at: string;
  updated_at: string;
};

type BangoMemoriesTableRow = LearningMemoryRow & {
  is_archived: boolean;
};

type DatabaseWithBangoMemories = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & {
      bango_memories: {
        Row: BangoMemoriesTableRow;
        Insert: Partial<BangoMemoriesTableRow>;
        Update: Partial<BangoMemoriesTableRow>;
        Relationships: [];
      };
    };
  };
};

export type LearningVendorRow = Pick<
  Database["public"]["Tables"]["vendors"]["Row"],
  "id" | "company_id" | "preferred_vendor" | "quality_rating" | "delivery_rating" | "status"
>;

export type LearningCustomerRow = Pick<
  Database["public"]["Tables"]["customers"]["Row"],
  "id" | "company_id" | "status" | "created_at" | "updated_at"
>;

export type LearningEquipmentRow = Pick<
  Database["public"]["Tables"]["equipment"]["Row"],
  "id" | "company_id" | "status" | "vendor_id" | "utilization_target_percent" | "created_at" | "updated_at"
>;

export type LearningMaterialRow = Pick<
  Database["public"]["Tables"]["materials"]["Row"],
  "id" | "company_id" | "status" | "preferred_vendor_id" | "current_stock" | "reorder_point" | "created_at" | "updated_at"
>;

export type LearningTimeScope = {
  fromIso: string | null;
  toIso: string;
};

export interface LearningProvider {
  getTasks(companyId: string, scope: LearningTimeScope): Promise<LearningTaskRow[]>;
  getProjects(companyId: string, scope: LearningTimeScope): Promise<LearningProjectRow[]>;
  getChangeOrders(companyId: string, scope: LearningTimeScope): Promise<LearningChangeOrderRow[]>;
  getEstimates(companyId: string, scope: LearningTimeScope): Promise<LearningEstimateRow[]>;
  getInvoices(companyId: string, scope: LearningTimeScope): Promise<LearningInvoiceRow[]>;
  getMemories(companyId: string, scope: LearningTimeScope): Promise<LearningMemoryRow[]>;
  getVendors(companyId: string): Promise<LearningVendorRow[]>;
  getCustomers(companyId: string): Promise<LearningCustomerRow[]>;
  getEquipment(companyId: string, scope: LearningTimeScope): Promise<LearningEquipmentRow[]>;
  getMaterials(companyId: string, scope: LearningTimeScope): Promise<LearningMaterialRow[]>;
}

function applyTimeRange<T extends { gte: (column: string, value: string) => T; lte: (column: string, value: string) => T }>(
  query: T,
  scope: LearningTimeScope,
  column: string,
): T {
  if (scope.fromIso) {
    return query.gte(column, scope.fromIso).lte(column, scope.toIso);
  }

  return query.lte(column, scope.toIso);
}

export class SupabaseLearningProvider implements LearningProvider {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async getTasks(companyId: string, scope: LearningTimeScope): Promise<LearningTaskRow[]> {
    let query = this.supabase
      .from("tasks")
      .select(
        "id,company_id,project_id,assigned_profile_id,status,completion_percentage,estimated_hours,actual_hours,created_at,updated_at",
      )
      .eq("company_id", companyId);

    query = applyTimeRange(query, scope, "created_at");
    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async getProjects(companyId: string, scope: LearningTimeScope): Promise<LearningProjectRow[]> {
    let query = this.supabase
      .from("projects")
      .select(
        "id,company_id,name,project_type,status,contract_amount,estimated_cost,estimated_start_date,estimated_end_date,actual_start_date,actual_end_date,customer_id,created_at,updated_at",
      )
      .eq("company_id", companyId);

    query = applyTimeRange(query, scope, "created_at");
    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async getChangeOrders(companyId: string, scope: LearningTimeScope): Promise<LearningChangeOrderRow[]> {
    let query = this.supabase
      .from("change_orders")
      .select("id,company_id,project_id,status,total_amount,created_at")
      .eq("company_id", companyId);

    query = applyTimeRange(query, scope, "created_at");
    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async getEstimates(companyId: string, scope: LearningTimeScope): Promise<LearningEstimateRow[]> {
    let query = this.supabase
      .from("estimates")
      .select("id,company_id,project_id,total_amount,status,created_at")
      .eq("company_id", companyId);

    query = applyTimeRange(query, scope, "created_at");
    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async getInvoices(companyId: string, scope: LearningTimeScope): Promise<LearningInvoiceRow[]> {
    let query = this.supabase
      .from("invoices")
      .select("id,company_id,project_id,total_amount,amount_paid,status,created_at")
      .eq("company_id", companyId);

    query = applyTimeRange(query, scope, "created_at");
    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async getMemories(companyId: string, scope: LearningTimeScope): Promise<LearningMemoryRow[]> {
    const supabaseWithMemories = this.supabase as unknown as SupabaseClient<DatabaseWithBangoMemories>;

    let query = supabaseWithMemories
      .from("bango_memories")
      .select(
        "id,company_id,project_id,customer_id,related_task_id,phase,category,content,source,relevance_score,recommendation_status,recommendation_outcome,verification_status,linked_vendor_id,linked_equipment_id,linked_material_id,created_at,updated_at",
      )
      .eq("company_id", companyId)
      .eq("is_archived", false);

    query = applyTimeRange(query, scope, "created_at");
    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      company_id: row.company_id,
      project_id: row.project_id,
      customer_id: row.customer_id,
      related_task_id: row.related_task_id,
      phase: row.phase,
      category: row.category,
      content: row.content,
      source: row.source,
      relevance_score: row.relevance_score,
      recommendation_status: row.recommendation_status,
      recommendation_outcome: row.recommendation_outcome,
      verification_status: row.verification_status,
      linked_vendor_id: row.linked_vendor_id,
      linked_equipment_id: row.linked_equipment_id,
      linked_material_id: row.linked_material_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  async getVendors(companyId: string): Promise<LearningVendorRow[]> {
    const { data, error } = await this.supabase
      .from("vendors")
      .select("id,company_id,preferred_vendor,quality_rating,delivery_rating,status")
      .eq("company_id", companyId);

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async getCustomers(companyId: string): Promise<LearningCustomerRow[]> {
    const { data, error } = await this.supabase
      .from("customers")
      .select("id,company_id,status,created_at,updated_at")
      .eq("company_id", companyId);

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async getEquipment(companyId: string, scope: LearningTimeScope): Promise<LearningEquipmentRow[]> {
    let query = this.supabase
      .from("equipment")
      .select("id,company_id,status,vendor_id,utilization_target_percent,created_at,updated_at")
      .eq("company_id", companyId);

    query = applyTimeRange(query, scope, "created_at");
    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async getMaterials(companyId: string, scope: LearningTimeScope): Promise<LearningMaterialRow[]> {
    let query = this.supabase
      .from("materials")
      .select("id,company_id,status,preferred_vendor_id,current_stock,reorder_point,created_at,updated_at")
      .eq("company_id", companyId);

    query = applyTimeRange(query, scope, "created_at");
    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return data ?? [];
  }
}
