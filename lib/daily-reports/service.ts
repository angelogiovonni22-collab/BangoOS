import {
  createDailyReport,
  createDraftFromSchedule,
  getDailyReportById,
  getDailyReportDashboardPayload,
  listDailyReports,
  regenerateDailyReportSummary,
  toUpsertInput,
  updateDailyReport,
} from "./mock-data";
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
  createReport: (input: DailyReportUpsertInput, status: DailyReportStatus) => Promise<DailyReport>;
  updateReport: (reportId: string, input: DailyReportUpsertInput, status: DailyReportStatus) => Promise<DailyReport | null>;
  regenerateSummary: (reportId: string) => Promise<DailyReport | null>;
  createDraftFromSchedule: (date: string) => Promise<DailyReportUpsertInput>;
  toUpsertInput: (report: DailyReport) => DailyReportUpsertInput;
};

export function createDailyReportsService(): DailyReportsService {
  return {
    async getDashboard() {
      return getDailyReportDashboardPayload();
    },

    async listReports(filters) {
      return listDailyReports(filters);
    },

    async getReport(reportId) {
      return getDailyReportById(reportId);
    },

    async createReport(input, status) {
      return createDailyReport(input, status);
    },

    async updateReport(reportId, input, status) {
      return updateDailyReport(reportId, input, status);
    },

    async regenerateSummary(reportId) {
      return regenerateDailyReportSummary(reportId);
    },

    async createDraftFromSchedule(date) {
      return createDraftFromSchedule(date);
    },

    toUpsertInput,
  };
}
