import { SearchInput, Select } from "@/components/ui";
import type { CrewAvailabilityStatus, CrewSortKey, CrewStatus } from "@/lib/crews";

type CrewFiltersProps = {
  query: string;
  status: CrewStatus | "all";
  availability: CrewAvailabilityStatus | "all";
  specialty: string;
  sortBy: CrewSortKey;
  specialtyOptions: string[];
  activeFilters: number;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: CrewStatus | "all") => void;
  onAvailabilityChange: (value: CrewAvailabilityStatus | "all") => void;
  onSpecialtyChange: (value: string) => void;
  onSortChange: (value: CrewSortKey) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function CrewFilters({
  query,
  status,
  availability,
  specialty,
  sortBy,
  specialtyOptions,
  activeFilters,
  onQueryChange,
  onStatusChange,
  onAvailabilityChange,
  onSpecialtyChange,
  onSortChange,
  t,
}: CrewFiltersProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <SearchInput
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={t("crews.filters.searchPlaceholder")}
        aria-label={t("crews.filters.searchPlaceholder")}
      />

      <Select value={status} onChange={(event) => onStatusChange(event.target.value as CrewStatus | "all")} aria-label={t("crews.filters.status")}>
        <option value="all">{t("crews.filters.allStatuses")}</option>
        <option value="active">{t("crews.status.active")}</option>
        <option value="standby">{t("crews.status.standby")}</option>
        <option value="inactive">{t("crews.status.inactive")}</option>
      </Select>

      <Select
        value={availability}
        onChange={(event) => onAvailabilityChange(event.target.value as CrewAvailabilityStatus | "all")}
        aria-label={t("crews.filters.availability")}
      >
        <option value="all">{t("crews.filters.allAvailability")}</option>
        <option value="available">{t("crews.availability.available")}</option>
        <option value="assigned">{t("crews.availability.assigned")}</option>
        <option value="off_shift">{t("crews.availability.off_shift")}</option>
        <option value="pto">{t("crews.availability.pto")}</option>
        <option value="training">{t("crews.availability.training")}</option>
        <option value="unavailable">{t("crews.availability.unavailable")}</option>
      </Select>

      <Select value={specialty} onChange={(event) => onSpecialtyChange(event.target.value)} aria-label={t("crews.filters.specialty")}>
        <option value="all">{t("crews.filters.allSpecialties")}</option>
        {specialtyOptions.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </Select>

      <div className="grid gap-2">
        <Select value={sortBy} onChange={(event) => onSortChange(event.target.value as CrewSortKey)} aria-label={t("crews.filters.sortBy")}>
          <option value="name_asc">{t("crews.sort.nameAsc")}</option>
          <option value="name_desc">{t("crews.sort.nameDesc")}</option>
          <option value="lead_asc">{t("crews.sort.leadAsc")}</option>
          <option value="lead_desc">{t("crews.sort.leadDesc")}</option>
          <option value="members_desc">{t("crews.sort.membersDesc")}</option>
          <option value="utilization_desc">{t("crews.sort.utilizationDesc")}</option>
          <option value="last_activity_desc">{t("crews.sort.lastActivityDesc")}</option>
        </Select>
        <p className="text-xs font-medium text-[var(--color-text-secondary)]" aria-live="polite">
          {t("crews.filters.activeFilters", { count: activeFilters })}
        </p>
      </div>
    </div>
  );
}
