import { Button, Select } from "@/components/ui";

type CrewPaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onPageSizeChange: (nextPageSize: number) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function CrewPagination({
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
}: CrewPaginationProps) {
  return (
    <div className="flex flex-col gap-3 border-t border-[var(--color-border-subtle)] px-6 py-4 md:flex-row md:items-center md:justify-between">
      <p className="text-sm font-medium text-[var(--color-text-secondary)]">
        {t("crews.pagination.showing", { page, totalPages, total })}
      </p>

      <div className="flex flex-wrap items-center gap-2.5">
        <label className="text-sm font-medium text-[var(--color-text-secondary)]" htmlFor="crews-page-size">
          {t("crews.pagination.rowsPerPage")}
        </label>
        <Select
          id="crews-page-size"
          value={String(pageSize)}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="h-9 w-20"
          aria-label={t("crews.pagination.rowsPerPage")}
        >
          {[8, 12, 16].map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </Select>

        <Button type="button" variant="outline" size="sm" disabled={!canPrev} onClick={onPrev}>
          {t("crews.pagination.previous")}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={!canNext} onClick={onNext}>
          {t("crews.pagination.next")}
        </Button>
      </div>
    </div>
  );
}
