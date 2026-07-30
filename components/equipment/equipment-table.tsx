import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Eye, Pencil } from "lucide-react";
import {
  Button,
  EnterpriseTable,
  EnterpriseTableBody,
  EnterpriseTableCell,
  EnterpriseTableFooter,
  EnterpriseTableHead,
  EnterpriseTableHeading,
  EnterpriseTableRow,
  IconButton,
  TableContainer,
} from "@/components/ui";
import { EquipmentStatusBadge } from "./equipment-status-badge";
import { MaintenanceStatusBadge } from "./maintenance-status-badge";
import { formatUsdCurrency, type EquipmentListItem } from "@/lib/equipment";

type EquipmentTableProps = {
  items: EquipmentListItem[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export function EquipmentTable({ items, total, page, pageSize, onPageChange }: EquipmentTableProps) {
  const router = useRouter();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = total === 0 ? 0 : Math.min(total, page * pageSize);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <TableContainer title="Equipment Directory" description="Manage company assets, ownership, maintenance, and pricing in one library.">
      <EnterpriseTable ariaLabel="Equipment directory table">
        <EnterpriseTableHead>
          <tr>
            <EnterpriseTableHeading>Equipment Number</EnterpriseTableHeading>
            <EnterpriseTableHeading>Name</EnterpriseTableHeading>
            <EnterpriseTableHeading>Type</EnterpriseTableHeading>
            <EnterpriseTableHeading>Manufacturer / Model</EnterpriseTableHeading>
            <EnterpriseTableHeading>Ownership</EnterpriseTableHeading>
            <EnterpriseTableHeading>Current Location</EnterpriseTableHeading>
            <EnterpriseTableHeading align="right">Effective Hourly Cost</EnterpriseTableHeading>
            <EnterpriseTableHeading align="right">Billable Rate</EnterpriseTableHeading>
            <EnterpriseTableHeading>Maintenance</EnterpriseTableHeading>
            <EnterpriseTableHeading>Status</EnterpriseTableHeading>
            <EnterpriseTableHeading>Updated</EnterpriseTableHeading>
            <EnterpriseTableHeading align="right">Actions</EnterpriseTableHeading>
          </tr>
        </EnterpriseTableHead>

        <EnterpriseTableBody>
          {items.map((equipment) => (
            <EnterpriseTableRow
              key={equipment.id}
              className="cursor-pointer"
              role="link"
              tabIndex={0}
              aria-label={`Open equipment ${equipment.equipmentNumber}`}
              onClick={(event) => {
                const target = event.target as HTMLElement;

                if (target.closest("a,button,input,select,textarea")) {
                  return;
                }

                router.push(`/equipment/${equipment.id}`);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") {
                  return;
                }

                event.preventDefault();
                router.push(`/equipment/${equipment.id}`);
              }}
            >
              <EnterpriseTableCell>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{equipment.equipmentNumber}</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{equipment.defaultCostCodeLabel || "No default cost code"}</p>
              </EnterpriseTableCell>

              <EnterpriseTableCell>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{equipment.name}</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{equipment.criticalityLevel.replace(/_/g, " ")} priority</p>
              </EnterpriseTableCell>

              <EnterpriseTableCell>{equipment.equipmentType?.replace(/_/g, " ") || "-"}</EnterpriseTableCell>

              <EnterpriseTableCell>
                <p className="text-sm text-[var(--color-text-primary)]">{[equipment.manufacturer, equipment.model].filter(Boolean).join(" / ") || "-"}</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{equipment.vendorName || "No vendor"}</p>
              </EnterpriseTableCell>

              <EnterpriseTableCell>{equipment.ownershipType.replace(/_/g, " ")}</EnterpriseTableCell>

              <EnterpriseTableCell>
                <p className="text-sm text-[var(--color-text-primary)]">{equipment.currentLocationType?.replace(/_/g, " ") || "-"}</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{equipment.currentLocationName || "-"}</p>
              </EnterpriseTableCell>

              <EnterpriseTableCell align="right">{formatUsdCurrency(equipment.effectiveInternalHourlyCost)}</EnterpriseTableCell>
              <EnterpriseTableCell align="right">{formatUsdCurrency(equipment.hourlyBillableRate)}</EnterpriseTableCell>

              <EnterpriseTableCell>
                <MaintenanceStatusBadge status={equipment.maintenanceStatus} />
              </EnterpriseTableCell>

              <EnterpriseTableCell>
                <EquipmentStatusBadge status={equipment.status} />
              </EnterpriseTableCell>

              <EnterpriseTableCell>{new Date(equipment.updatedAt).toLocaleDateString()}</EnterpriseTableCell>

              <EnterpriseTableCell align="right">
                <div className="inline-flex items-center gap-1">
                  <Link href={`/equipment/${equipment.id}`}>
                    <IconButton icon={<Eye size={15} />} label="View equipment" variant="ghost" size="sm" />
                  </Link>
                  <Link href={`/equipment/${equipment.id}/edit`}>
                    <IconButton icon={<Pencil size={15} />} label="Edit equipment" variant="ghost" size="sm" />
                  </Link>
                </div>
              </EnterpriseTableCell>
            </EnterpriseTableRow>
          ))}
        </EnterpriseTableBody>
      </EnterpriseTable>

      <EnterpriseTableFooter>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--color-text-secondary)]">Showing {showingFrom}-{showingTo} of {total}</p>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={!canPrev}>
              <ChevronLeft size={14} />
              Previous
            </Button>
            <span className="inline-flex min-w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)]">
              {page}
            </span>
            <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={!canNext}>
              Next
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </EnterpriseTableFooter>
    </TableContainer>
  );
}
