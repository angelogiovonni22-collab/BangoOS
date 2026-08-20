import type { ReactNode } from "react";

type PartialDataNoticeProps = {
  message: ReactNode;
};

export function PartialDataNotice({ message }: PartialDataNoticeProps) {
  return (
    <div
      data-bos-partial-data-notice="true"
      className="rounded-[var(--radius-control)] border border-[var(--color-warning-200)] bg-[var(--color-warning-50)] px-4 py-3 text-body-secondary font-medium text-[var(--color-warning-700)]"
    >
      {message}
    </div>
  );
}
