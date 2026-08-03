import { toUpsertInput } from "./mock-data";
import type {
  DailyReport,
  DailyReportDashboardPayload,
  DailyReportFilters,
  DailyReportListResult,
  DailyReportStatus,
  DailyReportUpsertInput,
} from "./types";

export type DailyReportsService = {
  getDashboard: () => Promise<DailyReportDashboardPayload>;
  listReports: (filters: DailyReportFilters) => Promise<DailyReportListResult>;
  getReport: (reportId: string) => Promise<DailyReport | null>;
  createReport: (
    input: DailyReportUpsertInput,
    status: DailyReportStatus,
  ) => Promise<DailyReport>;
  updateReport: (
    reportId: string,
    input: DailyReportUpsertInput,
    status: DailyReportStatus,
  ) => Promise<DailyReport | null>;
  regenerateSummary: (reportId: string) => Promise<DailyReport | null>;
  createDraftFromSchedule: (date: string) => Promise<DailyReportUpsertInput>;
  toUpsertInput: (report: DailyReport) => DailyReportUpsertInput;
};

const STORAGE_NOT_CONNECTED_MESSAGE = "Daily Reports storage not connected.";

function buildBlankDraft(date: string): DailyReportUpsertInput {
  return {
    header: {
      projectId: "",
      projectName: "",
      date,
      shift: "day",
      superintendentId: "",
      superintendentName: "",
      projectManagerName: "",
      weather: "mixed",
      temperatureF: 0,
      siteConditions: "dry",
      overallStatus: "draft",
    },
    schedulingPreload: null,
    labor: [],
    workCompleted: [],
    materials: [],
    safety: [],
    delays: [],
    attachments: [],
    timeline: [],
    aiSummaryVersion: 1,
  };
}

export function createDailyReportsService(): DailyReportsService {
  return {
    async getDashboard() {
      return {
        metrics: {
          reportsCreatedToday: 0,
          reportsPendingReview: 0,
          reportsSubmitted: 0,
          lateReports: 0,
          safetyIncidents: 0,
          delaysLogged: 0,
          laborHours: 0,
          weatherSnapshot: "unavailable",
        },
        analytics: {
          laborHours: 0,
          productionUnits: 0,
          delayEvents: 0,
          incidentCount: 0,
          completionRate: 0,
          averageSubmissionHours: 0,
        },
        weatherSnapshotText: "unavailable",
        projectOptions: [],
        superintendentOptions: [],
      };
    },

    async listReports(filters) {
      const page = Number.isFinite(filters.page) && filters.page > 0 ? filters.page : 1;
      const pageSize = Number.isFinite(filters.pageSize) && filters.pageSize > 0 ? filters.pageSize : 1;

      const response: DailyReportListResult = {
        items: [],
        total: 0,
        totalPages: 1,
        page,
        pageSize,
      };

      return response;
    },

    async getReport() {
      return null;
    },

    async createReport() {
      throw new Error(STORAGE_NOT_CONNECTED_MESSAGE);
    },

    async updateReport() {
      return null;
    },

    async regenerateSummary() {
      return null;
    },

    async createDraftFromSchedule(date) {
      return buildBlankDraft(date);
    },

    toUpsertInput,
  };
}
