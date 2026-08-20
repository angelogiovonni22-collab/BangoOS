import { SearchInput, Select } from "@/components/ui";
import type { AvailabilityStatus, EmploymentStatus, SortKey } from "@/lib/employees";

type EmployeeFiltersProps = {
  query: string;
  crewId: string;
  supervisorId: string;
  projectId: string;
  employmentStatus: EmploymentStatus | "all";
  availabilityStatus: AvailabilityStatus | "all";
  sortBy: SortKey;
  crewOptions: Array<{ id: string; label: string }>;
  supervisorOptions: Array<{ id: string; label: string }>;
  projectOptions: Array<{ id: string; label: string }>;
  activeFilters: number;
  onQueryChange: (value: string) => void;
  onCrewChange: (value: string) => void;
  onSupervisorChange: (value: string) => void;
  onProjectChange: (value: string) => void;
  onEmploymentStatusChange: (value: EmploymentStatus | "all") => void;
  onAvailabilityStatusChange: (value: AvailabilityStatus | "all") => void;
  onSortChange: (value: SortKey) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function EmployeeFilters({
  query,
  crewId,
  supervisorId,
  projectId,
  employmentStatus,
  availabilityStatus,
  sortBy,
  crewOptions,
  supervisorOptions,
  projectOptions,
  activeFilters,
  onQueryChange,
  onCrewChange,
  onSupervisorChange,
  onProjectChange,
  onEmploymentStatusChange,
  onAvailabilityStatusChange,
  onSortChange,
  t,
}: EmployeeFiltersProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div className="md:col-span-2 xl:col-span-2">
        <SearchInput
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t("employees.filters.searchPlaceholder")}
          aria-label={t("employees.filters.searchPlaceholder")}
        />
      </div>

      <Select value={crewId} onChange={(event) => onCrewChange(event.target.value)} aria-label={t("employees.filters.crew")}>
        <option value="all">{t("employees.filters.allCrews")}</option>
        {crewOptions.map((item) => (
          <option key={item.id} value={item.id}>{item.label}</option>
        ))}
      </Select>

      <Select value={supervisorId} onChange={(event) => onSupervisorChange(event.target.value)} aria-label="Supervisor filter">
        <option value="all">All supervisors</option>
        {supervisorOptions.map((item) => (
          <option key={item.id} value={item.id}>{item.label}</option>
        ))}
      </Select>

      <Select value={projectId} onChange={(event) => onProjectChange(event.target.value)} aria-label="Project filter">
        <option value="all">All projects</option>
        {projectOptions.map((item) => (
          <option key={item.id} value={item.id}>{item.label}</option>
        ))}
      </Select>

      <Select
        value={employmentStatus}
        onChange={(event) => onEmploymentStatusChange(event.target.value as EmploymentStatus | "all")}
        aria-label={t("employees.filters.employmentStatus")}
      >
        <option value="all">{t("employees.filters.allEmploymentStatuses")}</option>
        <option value="active">{t("employees.employmentStatus.active")}</option>
        <option value="leave">On leave</option>
        <option value="inactive">{t("employees.employmentStatus.inactive")}</option>
        <option value="terminated">Terminated</option>
      </Select>

      <Select
        value={availabilityStatus}
        onChange={(event) => onAvailabilityStatusChange(event.target.value as AvailabilityStatus | "all")}
        aria-label={t("employees.filters.availability")}
      >
        <option value="all">{t("employees.filters.allAvailabilityStatuses")}</option>
        <option value="available">{t("employees.availabilityStatus.available")}</option>
        <option value="assigned">{t("employees.availabilityStatus.assigned")}</option>
        <option value="unavailable">Unavailable</option>
        <option value="restricted">Restricted</option>
        <option value="unknown">Unknown</option>
      </Select>

      <div className="grid gap-2">
        <Select value={sortBy} onChange={(event) => onSortChange(event.target.value as SortKey)} aria-label={t("employees.filters.sortBy")}>
          <option value="name_asc">{t("employees.sort.nameAsc")}</option>
          <option value="name_desc">{t("employees.sort.nameDesc")}</option>
          <option value="employee_number_asc">Employee # ascending</option>
          <option value="employee_number_desc">Employee # descending</option>
          <option value="updated_desc">Recently updated</option>
          <option value="updated_asc">Least recently updated</option>
        </Select>
        <p className="text-xs font-medium text-[var(--color-text-secondary)]" aria-live="polite">
          {t("employees.filters.activeFilters", { count: activeFilters })}
        </p>
      </div>
    </div>
  );
}
