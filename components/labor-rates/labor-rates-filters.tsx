import { FilterToolbar, SearchInput, Select } from "@/components/ui";
import type {
  CostCodeOption,
  LaborRateSortKey,
  LaborRateStatus,
  SkillLevel,
  UnionStatus,
  WorkerClassification,
} from "@/lib/labor-rates";

type LaborRatesFiltersProps = {
  query: string;
  status: LaborRateStatus | "all";
  trade: string;
  skillLevel: SkillLevel | "all";
  unionStatus: UnionStatus | "all";
  workerClassification: WorkerClassification | "all";
  defaultCostCodeId: string;
  sortBy: LaborRateSortKey;
  costCodeOptions: CostCodeOption[];
  onQueryChange: (value: string) => void;
  onStatusChange: (value: LaborRateStatus | "all") => void;
  onTradeChange: (value: string) => void;
  onSkillLevelChange: (value: SkillLevel | "all") => void;
  onUnionStatusChange: (value: UnionStatus | "all") => void;
  onWorkerClassificationChange: (value: WorkerClassification | "all") => void;
  onDefaultCostCodeChange: (value: string) => void;
  onSortByChange: (value: LaborRateSortKey) => void;
  activeFilters: number;
};

export function LaborRatesFilters({
  query,
  status,
  trade,
  skillLevel,
  unionStatus,
  workerClassification,
  defaultCostCodeId,
  sortBy,
  costCodeOptions,
  onQueryChange,
  onStatusChange,
  onTradeChange,
  onSkillLevelChange,
  onUnionStatusChange,
  onWorkerClassificationChange,
  onDefaultCostCodeChange,
  onSortByChange,
  activeFilters,
}: LaborRatesFiltersProps) {
  return (
    <FilterToolbar
      gridClassName="md:grid-cols-2 xl:grid-cols-4"
      footer={<p className="text-xs font-medium text-[var(--color-text-secondary)]">Active filters: {activeFilters}</p>}
    >
      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)] xl:col-span-2">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Search</span>
        <SearchInput
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search code, name, trade, position, or skill"
          aria-label="Search labor rates"
          className="h-10 py-2"
        />
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Status</span>
        <Select value={status} onChange={(event) => onStatusChange(event.target.value as LaborRateStatus | "all")} className="h-10 py-2">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="archived">Archived</option>
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Trade</span>
        <SearchInput
          value={trade}
          onChange={(event) => onTradeChange(event.target.value)}
          placeholder="Filter trade"
          aria-label="Filter trade"
          className="h-10 py-2"
        />
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Skill Level</span>
        <Select value={skillLevel} onChange={(event) => onSkillLevelChange(event.target.value as SkillLevel | "all")} className="h-10 py-2">
          <option value="all">All skill levels</option>
          <option value="apprentice">Apprentice</option>
          <option value="helper">Helper</option>
          <option value="journeyman">Journeyman</option>
          <option value="foreman">Foreman</option>
          <option value="superintendent">Superintendent</option>
          <option value="specialist">Specialist</option>
          <option value="other">Other</option>
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Union Status</span>
        <Select value={unionStatus} onChange={(event) => onUnionStatusChange(event.target.value as UnionStatus | "all")} className="h-10 py-2">
          <option value="all">All union statuses</option>
          <option value="union">Union</option>
          <option value="non_union">Non-union</option>
          <option value="prevailing_wage">Prevailing wage</option>
          <option value="not_applicable">Not applicable</option>
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Worker Class</span>
        <Select value={workerClassification} onChange={(event) => onWorkerClassificationChange(event.target.value as WorkerClassification | "all")} className="h-10 py-2">
          <option value="all">All worker classes</option>
          <option value="w2">W2</option>
          <option value="1099">1099</option>
          <option value="temporary">Temporary</option>
          <option value="other">Other</option>
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Default Cost Code</span>
        <Select value={defaultCostCodeId} onChange={(event) => onDefaultCostCodeChange(event.target.value)} className="h-10 py-2">
          <option value="">All cost codes</option>
          {costCodeOptions.map((option) => (
            <option key={option.id} value={option.id}>{option.code} - {option.name}</option>
          ))}
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Sort by</span>
        <Select value={sortBy} onChange={(event) => onSortByChange(event.target.value as LaborRateSortKey)} className="h-10 py-2">
          <option value="code_asc">Code (A-Z)</option>
          <option value="name_asc">Name (A-Z)</option>
          <option value="trade_asc">Trade (A-Z)</option>
          <option value="base_hourly_rate_desc">Base rate (High-Low)</option>
          <option value="true_hourly_cost_desc">True cost (High-Low)</option>
          <option value="billable_hourly_rate_desc">Billable rate (High-Low)</option>
          <option value="updated_at_desc">Updated (Newest)</option>
        </Select>
      </label>
    </FilterToolbar>
  );
}
