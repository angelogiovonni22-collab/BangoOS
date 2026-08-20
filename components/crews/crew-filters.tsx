import { SearchInput, Select } from "@/components/ui";
import type { CrewSortKey, CrewStatus } from "@/lib/crews";

type CrewFiltersProps = {
  query: string;
  status: CrewStatus | "all";
  leadId: string;
  supervisorId: string;
  projectId: string;
  assignmentStatus: "all" | "none" | "planned" | "confirmed" | "in_progress" | "completed" | "cancelled";
  sortBy: CrewSortKey;
  leadOptions: Array<{ id: string; label: string }>;
  supervisorOptions: Array<{ id: string; label: string }>;
  projectOptions: Array<{ id: string; label: string }>;
  activeFilters: number;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: CrewStatus | "all") => void;
  onLeadChange: (value: string) => void;
  onSupervisorChange: (value: string) => void;
  onProjectChange: (value: string) => void;
  onAssignmentStatusChange: (value: "all" | "none" | "planned" | "confirmed" | "in_progress" | "completed" | "cancelled") => void;
  onSortChange: (value: CrewSortKey) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function CrewFilters({
  query,
  status,
  leadId,
  supervisorId,
  projectId,
  assignmentStatus,
  sortBy,
  leadOptions,
  supervisorOptions,
  projectOptions,
  activeFilters,
  onQueryChange,
  onStatusChange,
  onLeadChange,
  onSupervisorChange,
  onProjectChange,
  onAssignmentStatusChange,
  onSortChange,
  t,
}: CrewFiltersProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div className="md:col-span-2 xl:col-span-2">
        <SearchInput
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t("crews.filters.searchPlaceholder")}
          aria-label={t("crews.filters.searchPlaceholder")}
        />
      </div>

      <Select value={status} onChange={(event) => onStatusChange(event.target.value as CrewStatus | "all")} aria-label={t("crews.filters.status")}>
        <option value="all">{t("crews.filters.allStatuses")}</option>
        <option value="active">{t("crews.status.active")}</option>
        <option value="inactive">{t("crews.status.inactive")}</option>
        <option value="archived">Archived</option>
      </Select>

      <Select
        value={leadId}
        onChange={(event) => onLeadChange(event.target.value)}
        aria-label="Lead filter"
      >
        <option value="all">All leads</option>
        {leadOptions.map((item) => (
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

      <Select value={assignmentStatus} onChange={(event) => onAssignmentStatusChange(event.target.value as CrewFiltersProps["assignmentStatus"])} aria-label="Assignment status filter">
        <option value="all">All assignment statuses</option>
        <option value="none">No current assignment</option>
        <option value="planned">Planned</option>
        <option value="confirmed">Confirmed</option>
        <option value="in_progress">In progress</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
      </Select>

      <div className="grid gap-2">
        <Select value={sortBy} onChange={(event) => onSortChange(event.target.value as CrewSortKey)} aria-label={t("crews.filters.sortBy")}>
          <option value="name_asc">{t("crews.sort.nameAsc")}</option>
          <option value="name_desc">{t("crews.sort.nameDesc")}</option>
          <option value="members_desc">{t("crews.sort.membersDesc")}</option>
          <option value="updated_desc">Recently updated</option>
        </Select>
        <p className="text-xs font-medium text-[var(--color-text-secondary)]" aria-live="polite">
          {t("crews.filters.activeFilters", { count: activeFilters })}
        </p>
      </div>
    </div>
  );
}
