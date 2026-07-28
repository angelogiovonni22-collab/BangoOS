"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardLayoutState, WidgetId } from "./types";

const STORAGE_KEY = "bangoos.dashboard.layout.v1";

const defaultLayout: DashboardLayoutState = {
  order: [
    "kpi",
    "schedule",
    "project-health",
    "weather",
    "activity",
    "business-score",
    "command-center",
  ],
  hidden: [],
  collapsed: [],
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
  const [layout, setLayout] = useState<DashboardLayoutState>(() => {
    if (typeof window === "undefined") {
      return defaultLayout;
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return defaultLayout;
      }

      const parsed = JSON.parse(raw) as Partial<DashboardLayoutState>;
      return sanitizeLayout(parsed);
    } catch {
      return defaultLayout;
    }
  });

  useEffect(() => {
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
