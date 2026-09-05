"use client";

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
  TableContainer,
  IconLink,
} from "@/components/ui";
import { useAdaptiveBos } from "@/lib/adaptive-bos/provider";
import { type FleetGridRow } from "@/lib/equipment";

type EquipmentTableProps = {
  rows: FleetGridRow[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export function EquipmentTable({ rows, total, page, pageSize, onPageChange }: EquipmentTableProps) {
  const router = useRouter();
  const { term } = useAdaptiveBos();
  const equipmentLabel = term("equipment", "Equipment");
  const projectLabel = term("project", "Project");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = total === 0 ? 0 : Math.min(total, page * pageSize);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <TableContainer title={`${equipmentLabel} Directory`} description={`Manage company ${equipmentLabel.toLowerCase()}, ownership, maintenance, and pricing in one library.`}>
      <EnterpriseTable ariaLabel={`${equipmentLabel} directory table`}>
        <EnterpriseTableHead>
          <tr>
            <EnterpriseTableHeading>{equipmentLabel} ID</EnterpriseTableHeading>
            <EnterpriseTableHeading>Asset Name</EnterpriseTableHeading>
            <EnterpriseTableHeading>Category</EnterpriseTableHeading>
            <EnterpriseTableHeading>Manufacturer</EnterpriseTableHeading>
            <EnterpriseTableHeading>Model</EnterpriseTableHeading>
            <EnterpriseTableHeading>Serial Number</EnterpriseTableHeading>
            <EnterpriseTableHeading>Current {projectLabel}</EnterpriseTableHeading>
            <EnterpriseTableHeading>Assigned Team Member</EnterpriseTableHeading>
            <EnterpriseTableHeading>Status</EnterpriseTableHeading>
            <EnterpriseTableHeading>Hours</EnterpriseTableHeading>
            <EnterpriseTableHeading>Mileage</EnterpriseTableHeading>
            <EnterpriseTableHeading>Condition</EnterpriseTableHeading>
            <EnterpriseTableHeading>Inspection Status</EnterpriseTableHeading>
            <EnterpriseTableHeading>Maintenance Due</EnterpriseTableHeading>
            <EnterpriseTableHeading>Location</EnterpriseTableHeading>
            <EnterpriseTableHeading>Purchase Date</EnterpriseTableHeading>
            <EnterpriseTableHeading>Warranty</EnterpriseTableHeading>
            <EnterpriseTableHeading>QR Code</EnterpriseTableHeading>
            <EnterpriseTableHeading>Last Activity</EnterpriseTableHeading>
            <EnterpriseTableHeading align="right">Actions</EnterpriseTableHeading>
          </tr>
        </EnterpriseTableHead>

        <EnterpriseTableBody>
          {rows.map((row) => (
            <EnterpriseTableRow
              key={row.equipmentId}
              className="cursor-pointer"
              role="link"
              tabIndex={0}
              aria-label={`Open ${equipmentLabel} ${row.equipmentNumber}`}
              onClick={(event) => {
                const target = event.target as HTMLElement;
                if (target.closest("a,button,input,select,textarea")) return;
                router.push(`/equipment/${row.equipmentId}`);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                router.push(`/equipment/${row.equipmentId}`);
              }}
            >
              <EnterpriseTableCell><p className="text-sm font-semibold text-[var(--color-text-primary)]">{row.equipmentNumber}</p></EnterpriseTableCell>
              <EnterpriseTableCell>{row.assetName}</EnterpriseTableCell>
              <EnterpriseTableCell>{row.category}</EnterpriseTableCell>
              <EnterpriseTableCell>{row.manufacturer}</EnterpriseTableCell>
              <EnterpriseTableCell>{row.model}</EnterpriseTableCell>
              <EnterpriseTableCell>{row.serialNumber}</EnterpriseTableCell>
              <EnterpriseTableCell>{row.currentProject}</EnterpriseTableCell>
              <EnterpriseTableCell>{row.assignedEmployee}</EnterpriseTableCell>
              <EnterpriseTableCell>{row.status}</EnterpriseTableCell>
              <EnterpriseTableCell>{row.hours}</EnterpriseTableCell>
              <EnterpriseTableCell>{row.mileage}</EnterpriseTableCell>
              <EnterpriseTableCell>{row.condition}</EnterpriseTableCell>
              <EnterpriseTableCell>{row.inspectionStatus}</EnterpriseTableCell>
              <EnterpriseTableCell>{row.maintenanceDue}</EnterpriseTableCell>
              <EnterpriseTableCell>{row.location}</EnterpriseTableCell>
              <EnterpriseTableCell>{row.purchaseDate}</EnterpriseTableCell>
              <EnterpriseTableCell>{row.warranty}</EnterpriseTableCell>
              <EnterpriseTableCell>{row.qrCodeStatus}</EnterpriseTableCell>
              <EnterpriseTableCell>{new Date(row.lastActivity).toLocaleDateString()}</EnterpriseTableCell>
              <EnterpriseTableCell align="right">
                <div className="inline-flex items-center gap-1">
                  <IconLink href={`/equipment/${row.equipmentId}`} icon={<Eye size={15} />} label={`View ${equipmentLabel}`} variant="ghost" size="sm" />
                  <IconLink href={`/equipment/${row.equipmentId}/edit`} icon={<Pencil size={15} />} label={`Edit ${equipmentLabel}`} variant="ghost" size="sm" />
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
            <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={!canPrev}><ChevronLeft size={14} />Previous</Button>
            <span className="inline-flex min-w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)]">{page}</span>
            <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={!canNext}>Next<ChevronRight size={14} /></Button>
          </div>
        </div>
      </EnterpriseTableFooter>
    </TableContainer>
  );
}
