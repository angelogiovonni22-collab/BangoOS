"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext, type WorkspaceContext } from "@/lib/supabase/workspace";
import { buildExecutiveDashboardData } from "./live-data";
import type { DashboardSectionErrors, ExecutiveDashboardData } from "./types";

export function useExecutiveDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sectionErrors, setSectionErrors] = useState<DashboardSectionErrors>({});
  const [data, setData] = useState<ExecutiveDashboardData | null>(null);
  const [workspaceContext, setWorkspaceContext] = useState<WorkspaceContext | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    const run = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      if (!supabase) {
        if (isSubscribed) {
          setIsLoading(false);
          setErrorMessage("Unable to connect right now. Please try again shortly.");
        }

        return;
      }

      const workspace = await resolveWorkspaceContext(supabase);

      if (workspace.errorMessage || !workspace.context) {
        if (isSubscribed) {
          setErrorMessage(workspace.errorMessage);
          setIsLoading(false);
        }
        return;
      }

      try {
        const liveDashboard = await buildExecutiveDashboardData(supabase, workspace.context);

        if (!isSubscribed) {
          return;
        }

        setCompanyName(liveDashboard.companyName);
        setSectionErrors(liveDashboard.sectionErrors);
        setData(liveDashboard.data);
        setWorkspaceContext(workspace.context);
      } catch (error) {
        if (!isSubscribed) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Unable to load dashboard data right now.");
      }

      setIsLoading(false);
    };

    void run();

    return () => {
      isSubscribed = false;
    };
  }, [supabase]);

  const fallbackData = useMemo<ExecutiveDashboardData>(() => ({
    metrics: [],
    activities: [],
    projectHealth: {
      onScheduleCount: 0,
      atRiskCount: 0,
      behindScheduleCount: 0,
      projects: [],
    },
    schedule: [],
    weather: null,
    businessScore: null,
    businessSummary: null,
    recommendations: [],
    pendingFollowups: [],
    automationQueue: [],
    recentAutomations: [],
    estimatePipeline: {
      total: 0,
      draft: 0,
      sent: 0,
      viewed: 0,
      revisionRequested: 0,
      approved: 0,
      rejected: 0,
    },
    topPriorities: [],
    businessHealth: [],
    riskSummary: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
    decisionRecommendations: [],
    todaysDecisions: [],
    criticalAlerts: [],
    morningBriefing: {
      greeting: "",
      lines: [],
    },
    widgetDefinitions: [
      { id: "kpi", titleKey: "dashboard.metricSectionTitle", descriptionKey: "dashboard.metricSectionDescription" },
      { id: "schedule", titleKey: "dashboard.todaySchedule", descriptionKey: "dashboard.todayScheduleDescription" },
      { id: "project-health", titleKey: "dashboard.projectHealth", descriptionKey: "dashboard.projectHealthDescription" },
      { id: "weather", titleKey: "dashboard.weather", descriptionKey: "dashboard.weatherDescription" },
      { id: "activity", titleKey: "dashboard.recentActivity", descriptionKey: "dashboard.recentActivityDescription" },
      { id: "pending-followups", titleKey: "dashboard.pendingFollowupsTitle", descriptionKey: "dashboard.pendingFollowupsDescription" },
      { id: "automation-queue", titleKey: "dashboard.automationQueueTitle", descriptionKey: "dashboard.automationQueueDescription" },
      { id: "recent-automations", titleKey: "dashboard.recentAutomationsTitle", descriptionKey: "dashboard.recentAutomationsDescription" },
      { id: "estimate-pipeline", titleKey: "dashboard.estimatePipelineTitle", descriptionKey: "dashboard.estimatePipelineDescription" },
      { id: "top-priorities", titleKey: "dashboard.topPrioritiesTitle", descriptionKey: "dashboard.topPrioritiesDescription" },
      { id: "business-health", titleKey: "dashboard.businessHealthTitle", descriptionKey: "dashboard.businessHealthDescription" },
      { id: "risk-summary", titleKey: "dashboard.riskSummaryTitle", descriptionKey: "dashboard.riskSummaryDescription" },
      { id: "decision-recommendations", titleKey: "dashboard.decisionRecommendationsTitle", descriptionKey: "dashboard.decisionRecommendationsDescription" },
      { id: "todays-decisions", titleKey: "dashboard.todaysDecisionsTitle", descriptionKey: "dashboard.todaysDecisionsDescription" },
      { id: "critical-alerts", titleKey: "dashboard.criticalAlertsTitle", descriptionKey: "dashboard.criticalAlertsDescription" },
      { id: "business-score", titleKey: "dashboard.businessScoreTitle", descriptionKey: "dashboard.businessScoreDescription" },
      { id: "command-center", titleKey: "dashboard.commandCenterTitle", descriptionKey: "dashboard.commandCenterDescription" },
    ],
  }), []);
  const isMockData = false;

  return {
    companyName,
    isLoading,
    errorMessage,
    data: data ?? fallbackData,
    isMockData,
    sectionErrors,
    workspaceContext,
  };
}
