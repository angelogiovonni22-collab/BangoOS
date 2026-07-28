import { Button, Select } from "@/components/ui";

type EmployeePaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onPageSizeChange: (value: number) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function EmployeePagination({
  page,
  totalPages,
  total,
  pageSize,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onPageSizeChange,
  t,
}: EmployeePaginationProps) {
  return (
    <div className="flex flex-col gap-3 border-t border-[var(--color-border-subtle)] px-6 py-4 md:flex-row md:items-center md:justify-between">
      <p className="text-sm font-medium text-[var(--color-text-secondary)]">
        {t("employees.pagination.showing", { page, totalPages, total })}
      </p>

      <div className="flex flex-wrap items-center gap-2.5">
        <label className="text-sm font-medium text-[var(--color-text-secondary)]" htmlFor="employees-page-size">
          {t("employees.pagination.rowsPerPage")}
        </label>
        <Select
          id="employees-page-size"
          value={String(pageSize)}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="w-24"
        >
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="30">30</option>
        </Select>

        <Button type="button" variant="outline" size="sm" onClick={onPrev} disabled={!canPrev}>
          {t("employees.pagination.previous")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onNext} disabled={!canNext}>
          {t("employees.pagination.next")}
        </Button>
      </div>
    </div>
  );
}
