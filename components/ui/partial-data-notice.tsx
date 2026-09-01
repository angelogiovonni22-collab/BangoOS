import type { ReactNode } from "react";

type PartialDataNoticeProps = {
  message: ReactNode;
};

export function PartialDataNotice({ message }: PartialDataNoticeProps) {
  return (
    <div
      data-bos-partial-data-notice="true"
      className="rounded-[var(--radius-control)] border [border-color:color-mix(in_srgb,var(--color-warning-500)_38%,var(--color-border-subtle))] [background:color-mix(in_srgb,var(--color-warning-500)_9%,var(--color-surface-card))] px-4 py-3 text-body-secondary font-medium text-[var(--color-text-primary)]"
    >
      {message}
    </div>
  );
}