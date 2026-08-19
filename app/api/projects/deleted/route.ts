import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { hasBosPermission } from "@/lib/access-control/permissions";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";

type HistoryRow = {
  id: string;
  project_id: string;
  previous_status: string;
  deleted_at: string;
  deleted_by: string | null;
};

type ProjectRow = {
  id: string;
  name: string | null;
  customer_id: string | null;
  status: string | null;
};

type CustomerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  customer_type: string | null;
};

export async function GET() {
  try {
    const supabase = await createClient();
    if (!supabase) throw new Error("B.O.S. database is unavailable.");

    const workspace = await resolveWorkspaceContext(supabase as SupabaseClient<Database>);
    if (!workspace.context) throw new Error(workspace.errorMessage || "Unauthorized.");
    if (!hasBosPermission(workspace.context.role, "projects.manage")) {
      return NextResponse.json({ error: "Deleted project history is restricted to project-management roles." }, { status: 403 });
    }

    const { data: historyData, error: historyError } = await supabase
      .from("project_deletion_history" as never)
      .select("id,project_id,previous_status,deleted_at,deleted_by")
      .eq("company_id", workspace.context.companyId)
      .is("restored_at", null)
      .order("deleted_at", { ascending: false }) as unknown as {
        data: HistoryRow[] | null;
        error: { message: string } | null;
      };

    if (historyError) throw new Error(historyError.message || "Unable to load deleted project history.");
    const history = historyData || [];
    if (!history.length) return NextResponse.json({ projects: [] });

    const projectIds = history.map((item) => item.project_id);
    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("id,name,customer_id,status")
      .eq("company_id", workspace.context.companyId)
      .in("id", projectIds);
    if (projectError) throw new Error(projectError.message || "Unable to load deleted projects.");

    const projects = (projectData || []) as ProjectRow[];
    const customerIds = Array.from(new Set(projects.map((project) => project.customer_id).filter((value): value is string => Boolean(value))));
    let customers: CustomerRow[] = [];

    if (customerIds.length) {
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("id,first_name,last_name,company_name,customer_type")
        .eq("company_id", workspace.context.companyId)
        .in("id", customerIds);
      if (customerError) throw new Error(customerError.message || "Unable to load project customers.");
      customers = (customerData || []) as CustomerRow[];
    }

    const projectMap = new Map(projects.map((project) => [project.id, project]));
    const customerMap = new Map(customers.map((customer) => [customer.id, customer]));

    const result = history.map((entry) => {
      const project = projectMap.get(entry.project_id);
      const customer = project?.customer_id ? customerMap.get(project.customer_id) : null;
      return {
        historyId: entry.id,
        projectId: entry.project_id,
        projectName: project?.name?.trim() || "Unnamed Project",
        customerName: customer ? getCustomerDisplayName(customer) : "Not linked",
        previousStatus: entry.previous_status,
        deletedAt: entry.deleted_at,
      };
    });

    return NextResponse.json({ projects: result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load deleted projects." }, { status: 400 });
  }
}

function getCustomerDisplayName(customer: CustomerRow) {
  const companyName = customer.company_name?.trim() || "";
  const firstName = customer.first_name?.trim() || "";
  const lastName = customer.last_name?.trim() || "";
  const contactName = [firstName, lastName].filter(Boolean).join(" ");
  if (customer.customer_type?.trim().toLowerCase() === "commercial" && companyName) return companyName;
  return contactName || companyName || "Unnamed Customer";
}
