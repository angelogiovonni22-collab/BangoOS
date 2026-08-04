import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { OrionDecisionContext } from "./decision-types";

type LooseSupabase = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export function createDecisionContext(supabase: SupabaseClient<Database>, companyId: string): OrionDecisionContext {
  const db = supabase as unknown as LooseSupabase;
  const cache = new Map<string, unknown>();

  async function readCached<T>(key: string, load: () => Promise<T>) {
    if (cache.has(key)) {
      return cache.get(key) as T;
    }

    const value = await load();
    cache.set(key, value);
    return value;
  }

  return {
    supabase,
    companyId,
    now: () => new Date(),
    load: {
      estimates: async () => readCached("estimates", async () => {
        const { data, error } = await db
          .from("estimates")
          .select("id, company_id, customer_id, title, estimate_number, status, total_amount, expiration_date, created_at, followup_due_at, agreement_version_id, deposit_invoice_id")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(300);

        if (error) {
          throw new Error(error.message || "Unable to load estimates for decision context.");
        }

        return (data ?? []) as OrionDecisionContext["load"]["estimates"] extends () => Promise<infer T> ? T : never;
      }),
      customers: async () => readCached("customers", async () => {
        const { data, error } = await db
          .from("customers")
          .select("id, company_id, first_name, last_name, company_name, status, created_at, updated_at")
          .eq("company_id", companyId)
          .order("updated_at", { ascending: false })
          .limit(400);

        if (error) {
          throw new Error(error.message || "Unable to load customers for decision context.");
        }

        return (data ?? []) as OrionDecisionContext["load"]["customers"] extends () => Promise<infer T> ? T : never;
      }),
      projects: async () => readCached("projects", async () => {
        const { data, error } = await db
          .from("projects")
          .select("id, company_id, name, status, estimated_end_date, created_at, customer_id, description")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(300);

        if (error) {
          throw new Error(error.message || "Unable to load projects for decision context.");
        }

        return (data ?? []) as OrionDecisionContext["load"]["projects"] extends () => Promise<infer T> ? T : never;
      }),
      tasks: async () => readCached("tasks", async () => {
        const { data, error } = await db
          .from("tasks")
          .select("id, project_id, company_id, status, assigned_profile_id, planned_finish, planned_start, estimated_completion_date")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(600);

        if (error) {
          throw new Error(error.message || "Unable to load tasks for decision context.");
        }

        return (data ?? []) as OrionDecisionContext["load"]["tasks"] extends () => Promise<infer T> ? T : never;
      }),
      crews: async () => readCached("crews", async () => {
        const { data, error } = await db
          .from("crews")
          .select("id, company_id, name, status, supervisor_profile_id")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(300);

        if (error) {
          throw new Error(error.message || "Unable to load crews for decision context.");
        }

        return (data ?? []) as OrionDecisionContext["load"]["crews"] extends () => Promise<infer T> ? T : never;
      }),
      crewMemberships: async () => readCached("crewMemberships", async () => {
        const { data, error } = await db
          .from("crew_memberships")
          .select("id, company_id, crew_id, employee_id, status, starts_on, ends_on")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(600);

        if (error) {
          throw new Error(error.message || "Unable to load crew memberships for decision context.");
        }

        return (data ?? []) as OrionDecisionContext["load"]["crewMemberships"] extends () => Promise<infer T> ? T : never;
      }),
      employees: async () => readCached("employees", async () => {
        const { data, error } = await db
          .from("employees")
          .select("id, company_id, primary_crew_id, supervisor_profile_id, employment_status, availability_status, updated_at")
          .eq("company_id", companyId)
          .order("updated_at", { ascending: false })
          .limit(600);

        if (error) {
          throw new Error(error.message || "Unable to load employees for decision context.");
        }

        return (data ?? []) as OrionDecisionContext["load"]["employees"] extends () => Promise<infer T> ? T : never;
      }),
      invoices: async () => readCached("invoices", async () => {
        const { data, error } = await db
          .from("invoices")
          .select("id, company_id, customer_id, project_id, estimate_id, status, total_amount, amount_paid, due_date, created_at")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(300);

        if (error) {
          throw new Error(error.message || "Unable to load invoices for decision context.");
        }

        return (data ?? []) as OrionDecisionContext["load"]["invoices"] extends () => Promise<infer T> ? T : never;
      }),
      workflowEvents: async (eventTypes?: string[], limit = 300) => {
        const cacheKey = `workflowEvents:${(eventTypes || []).join(",")}:${limit}`;

        return readCached(cacheKey, async () => {
          let query = db
            .from("workflow_events")
            .select("id, company_id, event_type, reference_entity, reference_id, occurred_at, payload, actor_profile_id")
            .eq("company_id", companyId)
            .order("occurred_at", { ascending: false })
            .limit(limit);

          if (eventTypes && eventTypes.length > 0) {
            query = query.in("event_type", eventTypes);
          }

          const { data, error } = await query;

          if (error) {
            throw new Error(error.message || "Unable to load workflow events for decision context.");
          }

          return (data ?? []) as OrionDecisionContext["load"]["workflowEvents"] extends (a?: string[], b?: number) => Promise<infer T> ? T : never;
        });
      },
    },
  };
}
