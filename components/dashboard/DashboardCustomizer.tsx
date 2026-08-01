import { useEffect, useState } from "react";
import { useRef } from "react";
import { createPortal } from "react-dom";
import { LayerManager } from "@/components/bangoflow";
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
  const [position, setPosition] = useState({ top: 0, left: 0, maxHeight: 480 });
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useFocusTrap({
    active: open,
    containerRef: panelRef,
    onEscape: () => setOpen(false),
  });

  const orderedWidgets = layout.order
    .map((id) => widgets.find((widget) => widget.id === id))
    .filter((widget): widget is DashboardWidgetDefinition => Boolean(widget));

  useEffect(() => {
    if (!open) {
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const panelWidth = 320;
      const viewportPadding = 16;
      const nextLeft = Math.max(
        viewportPadding,
        Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - viewportPadding),
      );
      const nextTop = Math.min(rect.bottom + 8, window.innerHeight - 180);
      const nextMaxHeight = Math.max(220, window.innerHeight - nextTop - viewportPadding);

      setPosition({ top: nextTop, left: nextLeft, maxHeight: nextMaxHeight });
    };

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const panel = open && typeof document !== "undefined"
    ? createPortal(
        <>
          <LayerManager layer="overlay">
            <button
              type="button"
              aria-label={t("common.closeSidebar")}
              className="fixed inset-0 bg-slate-950/40"
              onClick={() => setOpen(false)}
            />
          </LayerManager>

          <LayerManager layer="spotlight">
            <div className="fixed w-80" style={{ top: `${position.top}px`, left: `${position.left}px` }}>
              <FadeIn delayMs={0} distancePx={4}>
                <div
                  ref={panelRef}
                  id="dashboard-customizer-panel"
                  role="dialog"
                  aria-modal="true"
                  tabIndex={-1}
                  className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-4 shadow-[var(--shadow-large)]"
                  style={{ maxHeight: `${position.maxHeight}px`, overflowY: "auto" }}
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
            </div>
          </LayerManager>
        </>,
        document.body,
      )
    : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls="dashboard-customizer-panel"
        className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)] shadow-[var(--shadow-small)] transition hover:bg-[var(--color-surface-subtle)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
        onClick={() => setOpen((current) => !current)}
      >
        {t("dashboard.customize")}
      </button>

      {panel}
    </div>
  );
}
