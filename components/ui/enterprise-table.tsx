import type { HTMLAttributes, ReactNode, TableHTMLAttributes } from "react";

type EnterpriseTableProps = { children: ReactNode; className?: string; minWidthClassName?: string; ariaLabel: string };
type EnterpriseTableHeadingProps = { children: ReactNode; align?: "left" | "right"; className?: string };
type EnterpriseTableRowProps = HTMLAttributes<HTMLTableRowElement> & { selected?: boolean };
type EnterpriseTableCellProps = { children: ReactNode; align?: "left" | "right"; className?: string };

export function EnterpriseTable({ children, className, minWidthClassName = "min-w-full", ariaLabel }: EnterpriseTableProps) {
  return <div className="max-w-full overflow-x-auto border-t border-[var(--color-border-subtle)] overscroll-x-contain"><table aria-label={ariaLabel} className={["w-full divide-y divide-[var(--color-border-subtle)]", minWidthClassName, className || ""].filter(Boolean).join(" ")}>{children}</table></div>;
}

export function EnterpriseTableHead({ children, className, ...props }: TableHTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={["bg-[var(--bos-bg-control)]", className || ""].filter(Boolean).join(" ")} {...props}>{children}</thead>;
}

export function EnterpriseTableBody({ children, className, ...props }: TableHTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={["divide-y divide-[var(--color-border-subtle)] bg-[var(--color-surface-card)]", className || ""].filter(Boolean).join(" ")} {...props}>{children}</tbody>;
}

export function EnterpriseTableHeading({ children, align = "left", className }: EnterpriseTableHeadingProps) {
  return <th scope="col" className={["px-3 py-3 text-table-header font-semibold text-[var(--bos-text-medium-on-light)] sm:px-5", align === "right" ? "text-right" : "text-left", className || ""].filter(Boolean).join(" ")}>{children}</th>;
}

export function EnterpriseTableRow({ children, className, selected = false, ...props }: EnterpriseTableRowProps) {
  return <tr className={["align-top transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-subtle)]", selected ? "bg-[var(--color-surface-muted)]" : "", className || ""].filter(Boolean).join(" ")} {...props}>{children}</tr>;
}

export function EnterpriseTableCell({ children, align = "left", className }: EnterpriseTableCellProps) {
  return <td className={["text-table-body whitespace-nowrap px-3 py-3 text-[var(--color-text-primary)] sm:px-5", align === "right" ? "text-right" : "text-left", className || ""].filter(Boolean).join(" ")}>{children}</td>;
}

export function EnterpriseTableFooter({ children }: { children: ReactNode }) {
  return <div className="border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 py-3 text-[var(--color-text-secondary)] sm:px-5">{children}</div>;
}
