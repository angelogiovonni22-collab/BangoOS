import { SearchInput, Select } from "@/components/ui";
import type { AvailabilityStatus, EmploymentStatus, SortKey } from "@/lib/employees";

type EmployeeFiltersProps = {
  query: string;
  crew: string;
  employmentStatus: EmploymentStatus | "all";
  availabilityStatus: AvailabilityStatus | "all";
  sortBy: SortKey;
  crewOptions: string[];
  activeFilters: number;
  onQueryChange: (value: string) => void;
  onCrewChange: (value: string) => void;
  onEmploymentStatusChange: (value: EmploymentStatus | "all") => void;
  onAvailabilityStatusChange: (value: AvailabilityStatus | "all") => void;
  onSortChange: (value: SortKey) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function EmployeeFilters({
  query,
  crew,
  employmentStatus,
  availabilityStatus,
  sortBy,
  crewOptions,
  activeFilters,
  onQueryChange,
  onCrewChange,
  onEmploymentStatusChange,
  onAvailabilityStatusChange,
  onSortChange,
  t,
}: EmployeeFiltersProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <SearchInput
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={t("employees.filters.searchPlaceholder")}
        aria-label={t("employees.filters.searchPlaceholder")}
      />

      <Select value={crew} onChange={(event) => onCrewChange(event.target.value)} aria-label={t("employees.filters.crew")}>
        <option value="all">{t("employees.filters.allCrews")}</option>
        {crewOptions.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </Select>

      <Select
        value={employmentStatus}
        onChange={(event) => onEmploymentStatusChange(event.target.value as EmploymentStatus | "all")}
        aria-label={t("employees.filters.employmentStatus")}
      >
        <option value="all">{t("employees.filters.allEmploymentStatuses")}</option>
        <option value="active">{t("employees.employmentStatus.active")}</option>
        <option value="on_leave">{t("employees.employmentStatus.on_leave")}</option>
        <option value="inactive">{t("employees.employmentStatus.inactive")}</option>
      </Select>

      <Select
        value={availabilityStatus}
        onChange={(event) => onAvailabilityStatusChange(event.target.value as AvailabilityStatus | "all")}
        aria-label={t("employees.filters.availability")}
      >
        <option value="all">{t("employees.filters.allAvailabilityStatuses")}</option>
        <option value="available">{t("employees.availabilityStatus.available")}</option>
        <option value="assigned">{t("employees.availabilityStatus.assigned")}</option>
        <option value="off_shift">{t("employees.availabilityStatus.off_shift")}</option>
      </Select>

      <div className="grid gap-2">
        <Select value={sortBy} onChange={(event) => onSortChange(event.target.value as SortKey)} aria-label={t("employees.filters.sortBy")}>
          <option value="name_asc">{t("employees.sort.nameAsc")}</option>
          <option value="name_desc">{t("employees.sort.nameDesc")}</option>
          <option value="position_asc">{t("employees.sort.positionAsc")}</option>
          <option value="position_desc">{t("employees.sort.positionDesc")}</option>
          <option value="crew_asc">{t("employees.sort.crewAsc")}</option>
          <option value="crew_desc">{t("employees.sort.crewDesc")}</option>
          <option value="status_asc">{t("employees.sort.statusAsc")}</option>
          <option value="status_desc">{t("employees.sort.statusDesc")}</option>
        </Select>
        <p className="text-xs font-medium text-[var(--color-text-secondary)]" aria-live="polite">
          {t("employees.filters.activeFilters", { count: activeFilters })}
        </p>
      </div>
    </div>
  );
}
