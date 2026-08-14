"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DashboardLayoutState, WidgetId } from "./types";

const STORAGE_KEY = "bangoos.dashboard.layout.v2";

const defaultLayout: DashboardLayoutState = {
  order: [
    "kpi",
    "schedule",
    "project-health",
    "weather",
    "activity",
    "pending-followups",
    "automation-queue",
    "recent-automations",
    "estimate-pipeline",
    "top-priorities",
    "business-health",
    "risk-summary",
    "decision-recommendations",
    "todays-decisions",
    "critical-alerts",
    "business-score",
    "command-center",
  ],
  hidden: [],
  collapsed: [
    "schedule",
    "project-health",
    "weather",
    "pending-followups",
    "automation-queue",
    "recent-automations",
    "risk-summary",
    "decision-recommendations",
    "todays-decisions",
    "critical-alerts",
    "command-center",
  ],
};

function sanitizeLayout(input: Partial<DashboardLayoutState> | null | undefined): DashboardLayoutState {
  if (!input) {
    return defaultLayout;
  }

  const knownIds = new Set<WidgetId>(defaultLayout.order);
  const order = (input.order || []).filter((id): id is WidgetId => knownIds.has(id as WidgetId));
  const hidden = (input.hidden || []).filter((id): id is WidgetId => knownIds.has(id as WidgetId));
  const collapsed = (input.collapsed || []).filter((id): id is WidgetId => knownIds.has(id as WidgetId));

  const ordered = [...order, ...defaultLayout.order.filter((id) => !order.includes(id))];

  return {
    order: ordered,
    hidden,
    collapsed,
  };
}

export function useDashboardLayout() {
  const [layout, setLayout] = useState<DashboardLayoutState>(defaultLayout);
  const layoutHydratedRef = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        layoutHydratedRef.current = true;
        return;
      }

      const parsed = JSON.parse(raw) as Partial<DashboardLayoutState>;
      const nextLayout = sanitizeLayout(parsed);
      queueMicrotask(() => {
        layoutHydratedRef.current = true;
        setLayout(nextLayout);
      });
    } catch {
      // Ignore storage parse/read errors and continue with defaults.
      layoutHydratedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!layoutHydratedRef.current) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  }, [layout]);

  const resetLayout = useCallback(() => {
    setLayout(defaultLayout);
  }, []);

  const toggleWidgetVisibility = useCallback((widgetId: WidgetId) => {
    setLayout((current) => {
      const isHidden = current.hidden.includes(widgetId);

      return {
        ...current,
        hidden: isHidden
          ? current.hidden.filter((id) => id !== widgetId)
          : [...current.hidden, widgetId],
      };
    });
  }, []);

  const toggleWidgetCollapsed = useCallback((widgetId: WidgetId) => {
    setLayout((current) => {
      const isCollapsed = current.collapsed.includes(widgetId);

      return {
        ...current,
        collapsed: isCollapsed
          ? current.collapsed.filter((id) => id !== widgetId)
          : [...current.collapsed, widgetId],
      };
    });
  }, []);

  const reorderWidgets = useCallback((sourceId: WidgetId, destinationId: WidgetId) => {
    if (sourceId === destinationId) {
      return;
    }

    setLayout((current) => {
      const nextOrder = [...current.order];
      const sourceIndex = nextOrder.indexOf(sourceId);
      const destinationIndex = nextOrder.indexOf(destinationId);

      if (sourceIndex < 0 || destinationIndex < 0) {
        return current;
      }

      nextOrder.splice(sourceIndex, 1);
      nextOrder.splice(destinationIndex, 0, sourceId);

      return {
        ...current,
        order: nextOrder,
      };
    });
  }, []);

  const visibleWidgetOrder = useMemo(
    () => layout.order.filter((widgetId) => !layout.hidden.includes(widgetId)),
    [layout],
  );

  return {
    layout,
    visibleWidgetOrder,
    resetLayout,
    reorderWidgets,
    toggleWidgetVisibility,
    toggleWidgetCollapsed,
  };
}
