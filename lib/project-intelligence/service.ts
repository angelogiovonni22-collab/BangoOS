import {
  buildMockRiskSummary,
  buildMockTimelineSummary,
  getProjectEventsMockData,
} from "./mock-data";
import type {
  ProjectEvent,
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
};

export function createProjectIntelligenceService(): ProjectIntelligenceService {
  return {
    async getProjectEvents(projectId) {
      return getProjectEventsMockData(projectId);
    },

    async getProjectEvent(projectId, eventId) {
      const events = getProjectEventsMockData(projectId);
      return events.find((event) => event.id === eventId) || null;
    },

    async getProjectTimelineSummary(projectId) {
      const events = getProjectEventsMockData(projectId);
      return buildMockTimelineSummary(events);
    },

    async getProjectRiskEvents(projectId) {
      const events = getProjectEventsMockData(projectId);
      return buildMockRiskSummary(events);
    },

    async getProjectFinancialEvents(projectId) {
      const events = getProjectEventsMockData(projectId);
      return events.filter((event) => event.financialImpact || event.impactAreas.includes("financial"));
    },

    async getProjectScheduleEvents(projectId) {
      const events = getProjectEventsMockData(projectId);
      return events.filter((event) => event.scheduleImpact || event.impactAreas.includes("schedule"));
    },
  };
}

// Future Supabase table recommendation:
// - table: project_events
// - columns: id, workspace_id, project_id, event_type, category, title, description,
//   actor_id, source, priority, status, metadata jsonb, related_entity jsonb,
//   attachments jsonb, financial_impact jsonb, schedule_impact jsonb, ai_context jsonb,
//   occurred_at, created_at, created_by
// - requirements: workspace isolation, project authorization, pagination, realtime subscriptions,
//   event immutability, audit logging, retention policy, and indexes on
//   (project_id, occurred_at, category, event_type).
