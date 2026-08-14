import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseOrionEventPublisher } from "@/lib/orion/events";
import { createOrionTimelineService } from "@/lib/orion/timeline";
import type { Database } from "@/types/database.types";
import type {
  EventMetadataValue,
  ProjectEvent,
  ProjectRelatedEntityType,
  ProjectTimelineRiskItem,
  ProjectTimelineSummary,
} from "./types";

export type ProjectIntelligenceService = {
  getProjectEvents: (projectId: string) => Promise<ProjectEvent[]>;
  getProjectEvent: (projectId: string, eventId: string) => Promise<ProjectEvent | null>;
  getProjectTimelineSummary: (projectId: string) => Promise<ProjectTimelineSummary>;
  getProjectRiskEvents: (projectId: string) => Promise<ProjectTimelineRiskItem[]>;
  getProjectFinancialEvents: (projectId: string) => Promise<ProjectEvent[]>;
  getProjectScheduleEvents: (projectId: string) => Promise<ProjectEvent[]>;
  publishProjectIntelligenceEvent: (input: {
    projectId: string;
    actorProfileId: string | null;
    eventType: "project.updated" | "project.status_changed" | "project.health_changed";
    title: string;
    note: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
};

export function createProjectIntelligenceService(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
}): ProjectIntelligenceService {
  const timeline = createOrionTimelineService(params.supabase);

  async function getProjectEvents(projectId: string) {
    const result = await timeline.listProjectTimeline(params.companyId, projectId, {
      pageSize: 80,
      includeLegacyAdapters: false,
    });

    return result.items.map((item) => mapTimelineToProjectEvent(projectId, item));
  }

  return {
    async getProjectEvents(projectId) {
      return getProjectEvents(projectId);
    },

    async getProjectEvent(projectId, eventId) {
      const events = await getProjectEvents(projectId);
      return events.find((event) => event.id === eventId) || null;
    },

    async getProjectTimelineSummary(projectId) {
      const events = await getProjectEvents(projectId);
      return {
        totalEvents: events.length,
        openRisks: events.filter((event) => event.priority === "high" || event.priority === "critical").length,
        financialImpactTotal: 0,
        scheduleDelayDays: 0,
        scheduleRecoveredDays: 0,
        lastDailyReportAt: events.find((event) => event.eventType === "daily_report_created")?.occurredAt || null,
        lastSiteCamUploadAt: events.find((event) => event.eventType === "site_photo_uploaded")?.occurredAt || null,
        latestCustomerActivityAt: events.find((event) => event.category === "customer")?.occurredAt || null,
        latestInspectionResult: "none",
        latestActivityAt: events[0]?.occurredAt || null,
        firstActivityAt: events[events.length - 1]?.occurredAt || null,
      };
    },

    async getProjectRiskEvents(projectId) {
      const events = await getProjectEvents(projectId);
      return events
        .filter((event) => event.priority === "critical" || event.priority === "high")
        .slice(0, 8)
        .map((event) => ({
          id: `risk-${event.id}`,
          severity: event.priority,
          message: event.description,
          sourceEventId: event.id,
          occurredAt: event.occurredAt,
          sourceLabel: event.source,
          recommendedAction: "Review related record.",
          href: event.relatedEntity?.href || null,
        }));
    },

    async getProjectFinancialEvents(projectId) {
      const events = await getProjectEvents(projectId);
      return events.filter((event) => event.category === "invoice" || event.category === "payment" || event.category === "estimate");
    },

    async getProjectScheduleEvents(projectId) {
      const events = await getProjectEvents(projectId);
      return events.filter((event) => event.category === "schedule" || event.category === "task" || event.category === "project");
    },

    async publishProjectIntelligenceEvent(input) {
      const publisher = createSupabaseOrionEventPublisher(params.supabase);
      await publisher.publishEvent({
        company_id: params.companyId,
        actor_profile_id: input.actorProfileId,
        event_type: input.eventType,
        aggregate_type: "project",
        aggregate_id: input.projectId,
        source_module: "project_intelligence",
        payload: {
          project_id: input.projectId,
          title: input.title,
          note: input.note,
          deep_link: `/projects/${input.projectId}`,
        },
        metadata: {
          event_category: "projects",
          event_severity: input.eventType === "project.health_changed" ? "attention" : "info",
          deep_link: `/projects/${input.projectId}`,
          ...(input.metadata || {}),
        },
      });
    },
  };
}

function mapTimelineToProjectEvent(projectId: string, item: Awaited<ReturnType<ReturnType<typeof createOrionTimelineService>["listProjectTimeline"]>>["items"][number]): ProjectEvent {
  const eventType = toProjectEventType(item.eventType);
  const category = toProjectCategory(item.category);

  return {
    id: item.id,
    projectId,
    eventType,
    category,
    title: item.title,
    description: item.summary,
    occurredAt: item.occurredAt,
    createdAt: item.occurredAt,
    actor: {
      id: item.actorProfileId || "system",
      name: item.actorName || "System",
      avatarUrl: null,
      role: "System",
      type: "system",
    },
    source: item.sourceModule === "system" ? "system" : "integration",
    priority: toProjectPriority(item.severity),
    status: "completed",
    impactAreas: [impactAreaForCategory(category)],
    metadata: toEventMetadataRecord(item.displayData),
    relatedEntity: item.href
      ? {
          id: item.entityId,
          type: toRelatedEntityType(item.entityType),
          label: item.projectName || item.customerName || item.entityType,
          href: item.href,
        }
      : null,
    attachments: [],
    financialImpact: null,
    scheduleImpact: null,
    aiContext: null,
  };
}

function toEventMetadataRecord(source: Record<string, unknown>): Record<string, EventMetadataValue> {
  const result: Record<string, EventMetadataValue> = {};

  for (const [key, value] of Object.entries(source)) {
    const converted = toEventMetadataValue(value);
    if (converted !== undefined) {
      result[key] = converted;
    }
  }

  return result;
}

function toEventMetadataValue(value: unknown): EventMetadataValue | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    const converted = value
      .map((entry) => toEventMetadataValue(entry))
      .filter((entry): entry is EventMetadataValue => entry !== undefined);
    return converted;
  }

  if (typeof value === "object") {
    const nested: Record<string, EventMetadataValue> = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      const converted = toEventMetadataValue(nestedValue);
      if (converted !== undefined) {
        nested[key] = converted;
      }
    }

    return nested;
  }

  return undefined;
}

function toProjectEventType(eventType: string): ProjectEvent["eventType"] {
  const map: Record<string, ProjectEvent["eventType"]> = {
    "customer.created": "customer_created",
    "estimate.created": "estimate_created",
    "estimate.sent": "estimate_sent",
    "estimate.approved": "estimate_approved",
    "project.created": "project_created",
    "invoice.created": "invoice_created",
    "invoice.sent": "invoice_sent",
    "invoice.paid": "invoice_paid",
    "employee.created": "employee_assigned",
    "crew.created": "employee_assigned",
    "crew.assigned": "employee_assigned",
    "change_order.created": "change_order_created",
    "daily_report.created": "daily_report_created",
    "task.completed": "task_completed",
  };

  return map[eventType] || "project_updated";
}

function toProjectCategory(category: string): ProjectEvent["category"] {
  const map: Record<string, ProjectEvent["category"]> = {
    customers: "customer",
    sales: "estimate",
    projects: "project",
    finance: "invoice",
    workforce: "employee",
    scheduling: "schedule",
    field: "daily_report",
    safety: "safety",
    system: "project",
  };

  return map[category] || "project";
}

function toProjectPriority(severity: string): ProjectEvent["priority"] {
  if (severity === "critical") {
    return "critical";
  }

  if (severity === "warning" || severity === "attention") {
    return "high";
  }

  if (severity === "success") {
    return "normal";
  }

  return "low";
}

function impactAreaForCategory(category: ProjectEvent["category"]): ProjectEvent["impactAreas"][number] {
  if (category === "invoice" || category === "estimate" || category === "change_order") {
    return "financial";
  }

  if (category === "schedule" || category === "task" || category === "project") {
    return "schedule";
  }

  if (category === "daily_report") {
    return "documentation";
  }

  if (category === "customer") {
    return "customer";
  }

  return "none";
}

function toRelatedEntityType(entityType: string): ProjectRelatedEntityType {
  if (entityType === "customer") {
    return "customer";
  }

  if (entityType === "estimate") {
    return "estimate";
  }

  if (entityType === "project") {
    return "project";
  }

  if (entityType === "invoice") {
    return "invoice";
  }

  if (entityType === "change_order") {
    return "change_order";
  }

  if (entityType === "daily_report") {
    return "daily_report";
  }

  if (entityType === "task") {
    return "task";
  }

  return "note";
}
