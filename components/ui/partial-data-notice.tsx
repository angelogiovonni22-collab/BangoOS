import type { ReactNode } from "react";

type PartialDataNoticeProps = {
  message: ReactNode;
};

export function PartialDataNotice({ message }: PartialDataNoticeProps) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-warning-200)] bg-[var(--color-warning-50)] px-4 py-3 text-sm text-[var(--color-warning-700)]">
      {message}
    </div>
  );
}