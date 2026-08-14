import type { SupabaseClient } from "@supabase/supabase-js";
import { createOrionTimelineService } from "@/lib/orion/timeline";
import type { WorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";
import { resolveIntentWithRole } from "./resolver";
import type { OrionIntentEntityRecord, OrionIntentInput } from "./types";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function logIntentTiming(stage: string, startedAt: number, details?: Record<string, unknown>) {
  if (IS_PRODUCTION || typeof console === "undefined") {
    return;
  }

  const elapsedMs = Number((nowMs() - startedAt).toFixed(1));
  if (details) {
    console.info(`[orion-timing] ${stage}`, { elapsedMs, ...details });
    return;
  }

  console.info(`[orion-timing] ${stage}`, { elapsedMs });
}

function maybe<T>(value: T | null | undefined) {
  return value ?? null;
}

function addStaticEntities(records: OrionIntentEntityRecord[]) {
  records.push(
    {
      entityType: "dashboard",
      entityId: "dashboard",
      label: "Dashboard",
      subtitle: "Executive dashboard",
      terms: ["dashboard", "home", "priorities", "alerts"],
    },
    {
      entityType: "timeline",
      entityId: "timeline",
      label: "Timeline",
      subtitle: "Orion activity timeline",
      terms: ["timeline", "activity", "history", "events"],
    },
    {
      entityType: "settings",
      entityId: "settings",
      label: "Settings",
      subtitle: "Workspace settings",
      terms: ["settings", "preferences", "configuration"],
    },
    {
      entityType: "operations",
      entityId: "operations",
      label: "Operations",
      subtitle: "Operations overview",
      terms: ["operations", "ops", "dispatch"],
    },
  );
}

function customerTerms(row: {
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  address_line_1: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
}) {
  return [
    row.company_name,
    row.first_name,
    row.last_name,
    row.address_line_1,
    row.city,
    row.state,
    row.phone,
    row.email,
  ].filter((value): value is string => Boolean(value));
}

export async function resolveOrionIntent(params: {
  supabase: SupabaseClient<Database>;
  workspace: WorkspaceContext;
  input: OrionIntentInput;
}) {
  const resolveStartedAt = nowMs();
  const { supabase, workspace, input } = params;
  const db = supabase as unknown as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
  };

  const staticEntities: OrionIntentEntityRecord[] = [];
  addStaticEntities(staticEntities);

  const fastPathResolution = resolveIntentWithRole({
    input,
    role: workspace.role,
    entities: staticEntities,
    recentEntityKeys: [],
  });

  if (
    fastPathResolution.suggestedCommand
    && !fastPathResolution.requiresClarification
    && fastPathResolution.confidence >= 0.95
    && (
      fastPathResolution.suggestedCommand.commandId === "dashboard.open"
      || fastPathResolution.suggestedCommand.commandId === "schedule.open"
      || fastPathResolution.suggestedCommand.commandId === "schedule.read_range"
      || fastPathResolution.suggestedCommand.commandId === "navigation.back"
    )
  ) {
    logIntentTiming("intent.fast_path.navigation", resolveStartedAt, {
      commandId: fastPathResolution.suggestedCommand.commandId,
    });
    return fastPathResolution;
  }

  const entityLookupStartedAt = nowMs();
  if (!IS_PRODUCTION && typeof console !== "undefined") {
    console.info("[orion-timing] intent.entity_lookup.start");
  }
  const [customers, projects, estimates, invoices, employees, crews, tasks, inspections, permits, communications] = await Promise.all([
    supabase
      .from("customers")
      .select("id, company_name, first_name, last_name, address_line_1, city, state, phone, email, status")
      .eq("company_id", workspace.companyId)
      .limit(80),
    supabase
      .from("projects")
      .select("id, name, project_number, address_line_1, city, state, status")
      .eq("company_id", workspace.companyId)
      .limit(80),
    supabase
      .from("estimates")
      .select("id, title, estimate_number, status")
      .eq("company_id", workspace.companyId)
      .limit(80),
    supabase
      .from("invoices")
      .select("id, title, invoice_number, status")
      .eq("company_id", workspace.companyId)
      .limit(80),
    supabase
      .from("employees")
      .select("id, employee_number, position_title, employment_status")
      .eq("company_id", workspace.companyId)
      .limit(80),
    supabase
      .from("crews")
      .select("id, name, crew_code, status")
      .eq("company_id", workspace.companyId)
      .limit(80),
    supabase
      .from("tasks")
      .select("id, title, task_number, status")
      .eq("company_id", workspace.companyId)
      .limit(80),
    db
      .from("project_inspections")
      .select("id, project_id, inspection_type, status, scheduled_at")
      .eq("company_id", workspace.companyId)
      .order("updated_at", { ascending: false })
      .limit(80),
    db
      .from("project_permits")
      .select("id, project_id, permit_type, status, permit_number")
      .eq("company_id", workspace.companyId)
      .order("updated_at", { ascending: false })
      .limit(80),
    db
      .from("project_communications")
      .select("id, project_id, customer_id, channel, direction, subject, status")
      .eq("company_id", workspace.companyId)
      .order("created_at", { ascending: false })
      .limit(80),
  ]);
  logIntentTiming("intent.entity_lookup.end", entityLookupStartedAt);

  const entities: OrionIntentEntityRecord[] = [];

  for (const row of customers.data || []) {
    const companyName = (row.company_name || "").trim();
    const contactName = [row.first_name, row.last_name].map((value) => (value || "").trim()).filter(Boolean).join(" ");
    const label = companyName || contactName || "Customer";
    entities.push({
      entityType: "customer",
      entityId: row.id,
      label,
      subtitle: `Customer ${row.status}`,
      terms: [...customerTerms(row), contactName].filter((value): value is string => Boolean(value && value.trim())),
    });
  }

  for (const row of projects.data || []) {
    entities.push({
      entityType: "project",
      entityId: row.id,
      label: row.name,
      subtitle: `Project ${row.status}`,
      terms: [row.name, maybe(row.project_number), maybe(row.address_line_1), maybe(row.city), maybe(row.state)].filter((value): value is string => Boolean(value)),
    });
  }

  for (const row of estimates.data || []) {
    entities.push({
      entityType: "estimate",
      entityId: row.id,
      label: row.estimate_number ? `${row.estimate_number} ${row.title}` : row.title,
      subtitle: `Estimate ${row.status}`,
      terms: [maybe(row.estimate_number), row.title, row.status].filter((value): value is string => Boolean(value)),
    });
  }

  for (const row of invoices.data || []) {
    entities.push({
      entityType: "invoice",
      entityId: row.id,
      label: row.invoice_number ? `${row.invoice_number} ${row.title}` : row.title,
      subtitle: `Invoice ${row.status}`,
      terms: [maybe(row.invoice_number), row.title, row.status].filter((value): value is string => Boolean(value)),
    });
  }

  for (const row of employees.data || []) {
    entities.push({
      entityType: "employee",
      entityId: row.id,
      label: `${row.employee_number} ${row.position_title}`,
      subtitle: `Employee ${row.employment_status}`,
      terms: [row.employee_number, row.position_title, row.employment_status],
    });
  }

  for (const row of crews.data || []) {
    entities.push({
      entityType: "crew",
      entityId: row.id,
      label: `${row.crew_code} ${row.name}`,
      subtitle: `Crew ${row.status}`,
      terms: [row.crew_code, row.name, row.status],
    });
  }

  for (const row of tasks.data || []) {
    entities.push({
      entityType: "task",
      entityId: row.id,
      label: `Task ${row.task_number} ${row.title}`,
      subtitle: `Task ${row.status}`,
      terms: [row.title, String(row.task_number), row.status],
    });
  }

  for (const row of inspections.data || []) {
    entities.push({
      entityType: "inspection",
      entityId: row.id,
      label: `${row.inspection_type} inspection`,
      subtitle: `Inspection ${row.status}`,
      terms: [row.inspection_type, row.status, row.scheduled_at || ""].filter((value): value is string => Boolean(value)),
      projectId: row.project_id,
    });
  }

  for (const row of permits.data || []) {
    entities.push({
      entityType: "permit",
      entityId: row.id,
      label: row.permit_number ? `${row.permit_type} ${row.permit_number}` : `${row.permit_type} permit`,
      subtitle: `Permit ${row.status}`,
      terms: [row.permit_type, row.permit_number || "", row.status].filter((value): value is string => Boolean(value)),
      projectId: row.project_id,
    });
  }

  for (const row of communications.data || []) {
    const subject = row.subject || `${row.channel} ${row.direction}`;
    entities.push({
      entityType: "communication",
      entityId: row.id,
      label: `Update ${subject}`,
      subtitle: `Communication ${row.status}`,
      terms: [row.channel, row.direction, row.subject || "", row.status].filter((value): value is string => Boolean(value)),
      projectId: row.project_id,
      customerId: row.customer_id,
    });
  }

  addStaticEntities(entities);

  const timelineLookupStartedAt = nowMs();
  if (!IS_PRODUCTION && typeof console !== "undefined") {
    console.info("[orion-timing] intent.timeline_lookup.start");
  }
  const timeline = await createOrionTimelineService(supabase).listCompanyTimeline(workspace.companyId, { pageSize: 20 });
  logIntentTiming("intent.timeline_lookup.end", timelineLookupStartedAt);

  const recentEntityKeys = timeline.items
    .map((item) => `${item.entityType}:${item.entityId}`)
    .filter((value) => value.includes(":"));

  const resolved = resolveIntentWithRole({
    input,
    role: workspace.role,
    entities,
    recentEntityKeys,
  });

  logIntentTiming("intent.resolve.end", resolveStartedAt, {
    hasSuggestion: Boolean(resolved.suggestedCommand),
    requiresClarification: resolved.requiresClarification,
  });

  return resolved;
}
