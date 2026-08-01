import { useState } from "react";
import { useRef } from "react";
import { FadeIn, useFocusTrap } from "@/components/motion";
import type { DashboardLayoutState, DashboardWidgetDefinition, WidgetId } from "@/lib/dashboard/types";

type DashboardCustomizerProps = {
  widgets: DashboardWidgetDefinition[];
  layout: DashboardLayoutState;
  t: (key: string, params?: Record<string, string | number>) => string;
  onToggleVisibility: (widgetId: WidgetId) => void;
  onToggleCollapsed: (widgetId: WidgetId) => void;
  onReorder: (sourceId: WidgetId, destinationId: WidgetId) => void;
  onReset: () => void;
};

export function DashboardCustomizer({
  widgets,
  layout,
  t,
  onToggleVisibility,
  onToggleCollapsed,
  onReorder,
  onReset,
}: DashboardCustomizerProps) {
  const [open, setOpen] = useState(false);
  const [dragId, setDragId] = useState<WidgetId | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap({
    active: open,
    containerRef: panelRef,
    onEscape: () => setOpen(false),
  });

  const orderedWidgets = layout.order
    .map((id) => widgets.find((widget) => widget.id === id))
    .filter((widget): widget is DashboardWidgetDefinition => Boolean(widget));

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="dashboard-customizer-panel"
        className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)] shadow-[var(--shadow-small)] transition hover:bg-[var(--color-surface-subtle)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
        onClick={() => setOpen((current) => !current)}
      >
        {t("dashboard.customize")}
      </button>

      {open ? (
        <FadeIn delayMs={0} distancePx={4} className="absolute right-0 z-30 mt-2 w-80">
        <div
          ref={panelRef}
          id="dashboard-customizer-panel"
          tabIndex={-1}
          className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-4 shadow-[var(--shadow-large)]"
        >
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t("dashboard.customizeTitle")}</p>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t("dashboard.customizeDescription")}</p>

          <div className="mt-4 space-y-2">
            {orderedWidgets.map((widget, index) => {
              const isVisible = !layout.hidden.includes(widget.id);
              const isCollapsed = layout.collapsed.includes(widget.id);

              return (
                <div
                  key={widget.id}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-2"
                  draggable
                  onDragStart={() => setDragId(widget.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragId && dragId !== widget.id) {
                      onReorder(dragId, widget.id);
                    }

                    setDragId(null);
                  }}
                  onDragEnd={() => setDragId(null)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={() => onToggleVisibility(widget.id)}
                        aria-label={t(widget.titleKey)}
                      />
                      <span className="text-sm text-[var(--color-text-primary)]">{t(widget.titleKey)}</span>
                    </label>

                    <button
                      type="button"
                      className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] px-2 py-1 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-primary)]"
                      onClick={() => onToggleCollapsed(widget.id)}
                    >
                      {isCollapsed ? t("dashboard.expand") : t("dashboard.collapse")}
                    </button>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] px-2 py-1 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-primary)]"
                      onClick={() => {
                        if (index > 0) {
                          onReorder(widget.id, orderedWidgets[index - 1].id);
                        }
                      }}
                      disabled={index === 0}
                    >
                      {t("dashboard.moveUp")}
                    </button>
                    <button
                      type="button"
                      className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] px-2 py-1 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-primary)]"
                      onClick={() => {
                        if (index < orderedWidgets.length - 1) {
                          onReorder(widget.id, orderedWidgets[index + 1].id);
                        }
                      }}
                      disabled={index === orderedWidgets.length - 1}
                    >
                      {t("dashboard.moveDown")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="mt-4 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-subtle)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
            onClick={onReset}
          >
            {t("dashboard.restoreDefault")}
          </button>
        </div>
        </FadeIn>
      ) : null}
    </div>
  );
}
