import type { DailyReportsService } from "./service";
import type { DailyReportStatus, DailyReportFilters } from "./types";

export type DailyReportsPageReport = {
  id: string;
  date: string;
  projectName: string;
  authorName: string;
  status: DailyReportStatus;
};

export type DailyReportsPageSummary = {
  total: number;
  pending: number;
  approved: number;
  reviewed: number;
};

export type DailyReportsPageData = {
  reports: DailyReportsPageReport[];
  summary: DailyReportsPageSummary;
};

const PAGE_SIZE = 1000;

const PAGE_FILTERS: DailyReportFilters = {
  date: "",
  projectId: "all",
  superintendentId: "all",
  status: "all",
  query: "",
  sortBy: "date_desc",
  page: 1,
  pageSize: PAGE_SIZE,
};

export async function loadDailyReportsPageData(service: Pick<DailyReportsService, "listReports">): Promise<DailyReportsPageData> {
  const result = await service.listReports(PAGE_FILTERS);

  const reports = result.items.map((report) => ({
    id: report.id,
    date: report.header.date,
    projectName: report.header.projectName,
    authorName: report.header.superintendentName || report.header.projectManagerName || "Unknown",
    status: report.header.overallStatus,
  }));

  return {
    reports,
    summary: {
      total: result.total,
      pending: result.items.filter((report) => report.header.overallStatus === "submitted").length,
      approved: result.items.filter((report) => report.header.overallStatus === "approved").length,
      reviewed: result.items.filter((report) => report.header.overallStatus === "reviewed").length,
    },
  };
}
