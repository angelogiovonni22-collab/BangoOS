import assert from "node:assert/strict";
import { loadDailyReportsPageData } from "./daily-reports-page-data";
import type { DailyReport, DailyReportFilters, DailyReportListResult } from "./types";

function makeReport(overrides: Partial<DailyReport> = {}): DailyReport {
  return {
    id: "report-1",
    reportNumber: "DR-1001",
    header: {
      projectId: "project-1",
      projectName: "Northpoint Medical Center",
      date: "2026-08-06",
      shift: "day",
      superintendentId: "sup-1",
      superintendentName: "Maya Rivera",
      projectManagerName: "Jordan Price",
      weather: "sunny",
      temperatureF: 90,
      siteConditions: "dry",
      overallStatus: "submitted",
    },
    schedulingPreload: null,
    labor: [],
    laborTotals: {
      scheduledWorkers: 0,
      presentWorkers: 0,
      absentWorkers: 0,
      lateWorkers: 0,
      overtimeWorkers: 0,
      totalLaborHours: 0,
    },
    workCompleted: [],
    materials: [],
    safety: [],
    delays: [],
    attachments: [],
    timeline: [],
    aiSummary: "",
    aiSummaryVersion: 1,
    submittedAt: null,
    reviewedAt: null,
    approvedAt: null,
    createdAt: "2026-08-06T00:00:00.000Z",
    updatedAt: "2026-08-06T00:00:00.000Z",
    ...overrides,
  };
}

async function main() {
  let passed = 0;
  let failed = 0;

  function check(condition: boolean, message: string) {
    if (condition) {
      passed += 1;
      console.log(`  + ${message}`);
    } else {
      failed += 1;
      console.error(`  x FAIL: ${message}`);
    }
  }

  const filters: DailyReportFilters = {
    date: "",
    projectId: "all",
    superintendentId: "all",
    status: "all",
    query: "",
    sortBy: "date_desc",
    page: 1,
    pageSize: 1000,
  };

  await test("1. successful load produces rows and summary", async () => {
    let callCount = 0;
    const result = await loadDailyReportsPageData({
      async listReports(nextFilters) {
        callCount += 1;
        assert.deepEqual(nextFilters, filters);
        const items = [
          makeReport(),
          makeReport({
            id: "report-2",
            header: {
              ...makeReport().header,
              overallStatus: "reviewed",
              superintendentName: "Nate McCall",
            },
          }),
          makeReport({
            id: "report-3",
            header: {
              ...makeReport().header,
              overallStatus: "approved",
              superintendentName: "Avery Cole",
            },
          }),
        ];
        return { items, total: items.length, totalPages: 1, page: 1, pageSize: 1000 } satisfies DailyReportListResult;
      },
    });

    check(callCount === 1, "page loader calls the service once");
    check(result.summary.total === 3, "summary total uses returned report count");
    check(result.summary.pending === 1, "summary pending counts submitted reports");
    check(result.summary.reviewed === 1, "summary reviewed counts reviewed reports");
    check(result.summary.approved === 1, "summary approved counts approved reports");
    check(result.reports[0].authorName === "Maya Rivera", "author falls back to superintendent name");
  });

  await test("2. empty load produces stable empty state data", async () => {
    const result = await loadDailyReportsPageData({
      async listReports() {
        return { items: [], total: 0, totalPages: 1, page: 1, pageSize: 1000 } satisfies DailyReportListResult;
      },
    });

    check(result.reports.length === 0, "empty result returns no rows");
    check(result.summary.total === 0, "empty result returns zero total");
    check(result.summary.pending === 0, "empty result returns zero pending");
    check(result.summary.reviewed === 0, "empty result returns zero reviewed");
    check(result.summary.approved === 0, "empty result returns zero approved");
  });

  await test("3. error load is surfaced", async () => {
    let thrown = false;
    try {
      await loadDailyReportsPageData({
        async listReports() {
          throw new Error("boom");
        },
      });
    } catch {
      thrown = true;
    }

    check(thrown, "loader propagates service errors for the page to render the static error state");
  });

  console.log(`\nDaily reports page data results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

async function test(name: string, run: () => Promise<void>) {
  console.log(`\n${name}`);
  await run();
}

void main();
