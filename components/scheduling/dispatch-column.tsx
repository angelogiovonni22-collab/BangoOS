import type { DispatchResource, DispatchStatus } from "@/lib/scheduling";
import { DispatchResourceCard } from "./dispatch-resource-card";

type DispatchColumnProps = {
  status: DispatchStatus;
  title: string;
  items: DispatchResource[];
  compact: boolean;
  onDropResource: (dispatchId: string, status: DispatchStatus) => void;
  onStatusChange: (dispatchId: string, status: DispatchStatus) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function DispatchColumn({
  status,
  title,
  items,
  compact,
  onDropResource,
  onStatusChange,
  t,
}: DispatchColumnProps) {
  return (
    <section
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const dispatchId = event.dataTransfer.getData("text/dispatch-id");
        if (dispatchId) {
          onDropResource(dispatchId, status);
        }
      }}
      className="min-h-[220px] rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3"
    >
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
        <span className="text-xs font-semibold text-[var(--color-text-secondary)]">{items.length}</span>
      </header>

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border-subtle)] p-2 text-xs text-[var(--color-text-secondary)]">
            {t("scheduling.empty.noDispatchResources")}
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("text/dispatch-id", item.id);
              }}
            >
              <DispatchResourceCard
                item={item}
                compact={compact}
                onStatusChange={(nextStatus) => onStatusChange(item.id, nextStatus)}
                t={t}
              />
            </div>
          ))
        )}
      </div>
    </section>
  );
}
