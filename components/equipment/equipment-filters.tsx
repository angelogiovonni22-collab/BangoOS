import { FilterToolbar, SearchInput, Select } from "@/components/ui";
import type {
  CriticalityLevel,
  CurrentLocationType,
  EquipmentSortKey,
  EquipmentStatus,
  EquipmentType,
  EquipmentVendorOption,
  MaintenanceStatus,
  OwnershipType,
  ReplacementPriority,
} from "@/lib/equipment";

type EquipmentFiltersProps = {
  query: string;
  status: EquipmentStatus | "all";
  equipmentType: EquipmentType | "all";
  category: string;
  assignedJobId: string;
  assignedEmployeeId: string;
  ownershipType: OwnershipType | "all";
  vendorId: string;
  maintenanceStatus: MaintenanceStatus | "all";
  locationType: CurrentLocationType | "all";
  defaultCostCodeId: string;
  criticalityLevel: CriticalityLevel | "all";
  replacementPriority: ReplacementPriority | "all";
  sortBy: EquipmentSortKey;
  vendorOptions: EquipmentVendorOption[];
  costCodeOptions: { id: string; code: string; name: string }[];
  projectOptions: Array<{ id: string; name: string }>;
  employeeOptions: Array<{ id: string; fullName: string }>;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: EquipmentStatus | "all") => void;
  onEquipmentTypeChange: (value: EquipmentType | "all") => void;
  onCategoryChange: (value: string) => void;
  onAssignedJobChange: (value: string) => void;
  onAssignedEmployeeChange: (value: string) => void;
  onOwnershipTypeChange: (value: OwnershipType | "all") => void;
  onVendorChange: (value: string) => void;
  onMaintenanceStatusChange: (value: MaintenanceStatus | "all") => void;
  onLocationTypeChange: (value: CurrentLocationType | "all") => void;
  onDefaultCostCodeChange: (value: string) => void;
  onCriticalityLevelChange: (value: CriticalityLevel | "all") => void;
  onReplacementPriorityChange: (value: ReplacementPriority | "all") => void;
  onSortByChange: (value: EquipmentSortKey) => void;
  activeFilters: number;
};

export function EquipmentFilters({
  query,
  status,
  equipmentType,
  category,
  assignedJobId,
  assignedEmployeeId,
  ownershipType,
  vendorId,
  maintenanceStatus,
  locationType,
  defaultCostCodeId,
  criticalityLevel,
  replacementPriority,
  sortBy,
  vendorOptions,
  costCodeOptions,
  projectOptions,
  employeeOptions,
  onQueryChange,
  onStatusChange,
  onEquipmentTypeChange,
  onCategoryChange,
  onAssignedJobChange,
  onAssignedEmployeeChange,
  onOwnershipTypeChange,
  onVendorChange,
  onMaintenanceStatusChange,
  onLocationTypeChange,
  onDefaultCostCodeChange,
  onCriticalityLevelChange,
  onReplacementPriorityChange,
  onSortByChange,
  activeFilters,
}: EquipmentFiltersProps) {
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
          placeholder="Search equipment, asset tag, serial, or VIN"
          aria-label="Search equipment"
          className="h-10 py-2"
        />
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Status</span>
        <Select value={status} onChange={(event) => onStatusChange(event.target.value as EquipmentStatus | "all")} className="h-10 py-2">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="maintenance">Maintenance</option>
          <option value="out_of_service">Out of service</option>
          <option value="retired">Retired</option>
          <option value="sold">Sold</option>
          <option value="lost">Lost</option>
          <option value="stolen">Stolen</option>
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Equipment Type</span>
        <Select value={equipmentType} onChange={(event) => onEquipmentTypeChange(event.target.value as EquipmentType | "all")} className="h-10 py-2">
          <option value="all">All types</option>
          <option value="heavy_equipment">Heavy equipment</option>
          <option value="vehicle">Vehicle</option>
          <option value="trailer">Trailer</option>
          <option value="power_tool">Power tool</option>
          <option value="hand_tool">Hand tool</option>
          <option value="safety_equipment">Safety equipment</option>
          <option value="office_equipment">Office equipment</option>
          <option value="technology">Technology</option>
          <option value="rented_equipment">Rented equipment</option>
          <option value="other">Other</option>
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Category</span>
        <SearchInput value={category} onChange={(event) => onCategoryChange(event.target.value)} placeholder="Filter category" aria-label="Filter category" className="h-10 py-2" />
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Project</span>
        <Select value={assignedJobId} onChange={(event) => onAssignedJobChange(event.target.value)} className="h-10 py-2">
          <option value="">All projects</option>
          {projectOptions.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Assigned Employee</span>
        <Select value={assignedEmployeeId} onChange={(event) => onAssignedEmployeeChange(event.target.value)} className="h-10 py-2">
          <option value="">All employees</option>
          {employeeOptions.map((employee) => (
            <option key={employee.id} value={employee.id}>{employee.fullName}</option>
          ))}
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Ownership</span>
        <Select value={ownershipType} onChange={(event) => onOwnershipTypeChange(event.target.value as OwnershipType | "all")} className="h-10 py-2">
          <option value="all">All ownership types</option>
          <option value="owned">Owned</option>
          <option value="financed">Financed</option>
          <option value="leased">Leased</option>
          <option value="rented">Rented</option>
          <option value="subcontractor_provided">Subcontractor provided</option>
          <option value="employee_owned">Employee owned</option>
          <option value="other">Other</option>
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Vendor</span>
        <Select value={vendorId} onChange={(event) => onVendorChange(event.target.value)} className="h-10 py-2">
          <option value="">All vendors</option>
          {vendorOptions.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>{vendor.displayName}</option>
          ))}
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Maintenance</span>
        <Select value={maintenanceStatus} onChange={(event) => onMaintenanceStatusChange(event.target.value as MaintenanceStatus | "all")} className="h-10 py-2">
          <option value="all">All maintenance states</option>
          <option value="current">Current</option>
          <option value="due_soon">Due soon</option>
          <option value="overdue">Overdue</option>
          <option value="in_service">In service</option>
          <option value="unavailable">Unavailable</option>
          <option value="not_required">Not required</option>
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Location</span>
        <Select value={locationType} onChange={(event) => onLocationTypeChange(event.target.value as CurrentLocationType | "all")} className="h-10 py-2">
          <option value="all">All locations</option>
          <option value="warehouse">Warehouse</option>
          <option value="jobsite">Jobsite</option>
          <option value="vehicle">Vehicle</option>
          <option value="employee">Employee</option>
          <option value="rental_provider">Rental provider</option>
          <option value="repair_shop">Repair shop</option>
          <option value="office">Office</option>
          <option value="unknown">Unknown</option>
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
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Criticality</span>
        <Select value={criticalityLevel} onChange={(event) => onCriticalityLevelChange(event.target.value as CriticalityLevel | "all")} className="h-10 py-2">
          <option value="all">All levels</option>
          <option value="low">Low</option>
          <option value="standard">Standard</option>
          <option value="high">High</option>
          <option value="mission_critical">Critical</option>
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Replacement</span>
        <Select value={replacementPriority} onChange={(event) => onReplacementPriorityChange(event.target.value as ReplacementPriority | "all")} className="h-10 py-2">
          <option value="all">All priorities</option>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Sort by</span>
        <Select value={sortBy} onChange={(event) => onSortByChange(event.target.value as EquipmentSortKey)} className="h-10 py-2">
          <option value="equipment_number_asc">Equipment number (A-Z)</option>
          <option value="name_asc">Name (A-Z)</option>
          <option value="equipment_type_asc">Type</option>
          <option value="manufacturer_asc">Manufacturer</option>
          <option value="purchase_price_desc">Purchase price (High-Low)</option>
          <option value="current_value_desc">Current value (High-Low)</option>
          <option value="effective_internal_hourly_cost_desc">Effective hourly cost (High-Low)</option>
          <option value="hourly_billable_rate_desc">Billable rate (High-Low)</option>
          <option value="maintenance_status_asc">Maintenance status</option>
          <option value="next_service_date_asc">Next service date</option>
          <option value="updated_at_desc">Updated date</option>
        </Select>
      </label>
    </FilterToolbar>
  );
}
