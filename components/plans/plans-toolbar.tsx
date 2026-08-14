import { Columns3, Filter, ListFilter, Search, SlidersHorizontal } from "lucide-react";
import { Button, FilterToolbar, SearchInput, Select } from "@/components/ui";
import type { DocumentDiscipline, DocumentStatus, PlansSortDirection, PlansSortKey } from "./types";

type PlansToolbarProps = {
  searchTerm: string;
  disciplineFilter: "all" | DocumentDiscipline;
  statusFilter: "all" | DocumentStatus;
  sortKey: PlansSortKey;
  sortDirection: PlansSortDirection;
  selectedCount: number;
  sidebarOpen: boolean;
  onSearchTermChange: (value: string) => void;
  onDisciplineFilterChange: (value: "all" | DocumentDiscipline) => void;
  onStatusFilterChange: (value: "all" | DocumentStatus) => void;
  onSortKeyChange: (value: PlansSortKey) => void;
  onSortDirectionToggle: () => void;
  onToggleSidebar: () => void;
};

export function PlansToolbar({
  searchTerm,
  disciplineFilter,
  statusFilter,
  sortKey,
  sortDirection,
  selectedCount,
  sidebarOpen,
  onSearchTermChange,
  onDisciplineFilterChange,
  onStatusFilterChange,
  onSortKeyChange,
  onSortDirectionToggle,
  onToggleSidebar,
}: PlansToolbarProps) {
  const footer = (
    <p className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
      <ListFilter size={13} aria-hidden="true" />
      Multi-select, sorting, and filtering are active across the current folder view.
    </p>
  );

  return (
    <FilterToolbar className="space-y-4 border-0 bg-transparent p-0 shadow-none" footer={footer}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="toolbar" size="sm" onClick={onToggleSidebar} aria-pressed={sidebarOpen}>
            <Columns3 size={15} aria-hidden="true" />
            {sidebarOpen ? "Hide folders" : "Show folders"}
          </Button>
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            {selectedCount} selected
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
          <Filter size={14} aria-hidden="true" />
          Sort and filter document register
        </div>
      </div>

      <div className="grid gap-[var(--grid-gap-compact)] lg:grid-cols-2 xl:grid-cols-5">
        <label className="relative xl:col-span-2">
          <span className="sr-only">Search plans</span>
          <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-[var(--z-base)] -translate-y-1/2 text-[var(--color-text-muted)]" />
          <SearchInput
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Search by file name, revision, or uploader"
            className="h-10 py-2 pl-10"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Discipline</span>
          <Select
            value={disciplineFilter}
            onChange={(event) => onDisciplineFilterChange(event.target.value as "all" | DocumentDiscipline)}
            aria-label="Filter documents by discipline"
            className="h-10 py-2"
          >
            <option value="all">All disciplines</option>
            <option value="Architectural">Architectural</option>
            <option value="Structural">Structural</option>
            <option value="Civil">Civil</option>
            <option value="Mechanical">Mechanical</option>
            <option value="Electrical">Electrical</option>
            <option value="Plumbing">Plumbing</option>
            <option value="Fire Protection">Fire Protection</option>
            <option value="Specifications">Specifications</option>
            <option value="Permits">Permits</option>
            <option value="Photos">Photos</option>
            <option value="Archived">Archived</option>
          </Select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Status</span>
          <Select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value as "all" | DocumentStatus)}
            aria-label="Filter documents by status"
            className="h-10 py-2"
          >
            <option value="all">All statuses</option>
            <option value="Draft">Draft</option>
            <option value="In Review">In Review</option>
            <option value="Approved">Approved</option>
            <option value="Superseded">Superseded</option>
            <option value="Archived">Archived</option>
          </Select>
        </label>

        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Sort</span>
          <div className="flex gap-2">
            <Select value={sortKey} onChange={(event) => onSortKeyChange(event.target.value as PlansSortKey)} aria-label="Sort key" className="h-10 py-2">
              <option value="fileName">File name</option>
              <option value="discipline">Discipline</option>
              <option value="revision">Revision</option>
              <option value="status">Status</option>
              <option value="uploadedBy">Uploaded by</option>
              <option value="uploadedAt">Date</option>
              <option value="sizeInBytes">Size</option>
              <option value="linkedRfis">Linked RFIs</option>
            </Select>
            <Button
              size="sm"
              variant="toolbar"
              className="h-10 px-3"
              onClick={onSortDirectionToggle}
              aria-label={`Sort direction ${sortDirection}`}
            >
              <SlidersHorizontal size={16} aria-hidden="true" />
              {sortDirection === "asc" ? "Asc" : "Desc"}
            </Button>
          </div>
        </div>
      </div>
    </FilterToolbar>
  );
}
