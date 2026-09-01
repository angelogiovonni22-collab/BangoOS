import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Eye, Pencil } from "lucide-react";
import {
  Badge,
  Button,
  EnterpriseTable,
  EnterpriseTableBody,
  EnterpriseTableCell,
  EnterpriseTableFooter,
  EnterpriseTableHead,
  EnterpriseTableHeading,
  EnterpriseTableRow,
  StatusBadge,
  TableContainer,
  IconLink,
} from "@/components/ui";
import { getStockBadgeLabel, getStockBadgeTone, type MaterialListItem } from "@/lib/materials";

type MaterialsTableProps = {
  items: MaterialListItem[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export function MaterialsTable({ items, total, page, pageSize, onPageChange }: MaterialsTableProps) {
  const router = useRouter();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = total === 0 ? 0 : Math.min(total, page * pageSize);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <TableContainer
      title="Materials Catalog"
      description="Manage costing, inventory, and vendor preferences for your materials."
    >
      <EnterpriseTable ariaLabel="Materials catalog table">
        <EnterpriseTableHead>
          <tr>
            <EnterpriseTableHeading>Material</EnterpriseTableHeading>
            <EnterpriseTableHeading>Code</EnterpriseTableHeading>
            <EnterpriseTableHeading>Status</EnterpriseTableHeading>
            <EnterpriseTableHeading>Stock</EnterpriseTableHeading>
            <EnterpriseTableHeading>Preferred vendor</EnterpriseTableHeading>
            <EnterpriseTableHeading align="right">Standard cost</EnterpriseTableHeading>
            <EnterpriseTableHeading align="right">Actions</EnterpriseTableHeading>
          </tr>
        </EnterpriseTableHead>

        <EnterpriseTableBody>
          {items.map((material) => (
            <EnterpriseTableRow
              key={material.id}
              className="cursor-pointer"
              role="link"
              tabIndex={0}
              aria-label={`Open material ${material.name}`}
              onClick={(event) => {
                const target = event.target as HTMLElement;

                if (target.closest("a,button,input,select,textarea")) {
                  return;
                }

                router.push(`/materials/${material.id}`);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") {
                  return;
                }

                event.preventDefault();
                router.push(`/materials/${material.id}`);
              }}
            >
              <EnterpriseTableCell>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{material.name}</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{material.category || material.trade || "Uncategorized"}</p>
              </EnterpriseTableCell>

              <EnterpriseTableCell>{material.materialCode}</EnterpriseTableCell>

              <EnterpriseTableCell>
                <StatusBadge status={material.status} />
              </EnterpriseTableCell>

              <EnterpriseTableCell>
                <div className="inline-flex items-center gap-2">
                  <Badge tone={getStockBadgeTone(material)}>{getStockBadgeLabel(material)}</Badge>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {material.trackInventory ? `${material.currentStock.toFixed(2)} ${material.unitOfMeasure}` : "-"}
                  </span>
                </div>
              </EnterpriseTableCell>

              <EnterpriseTableCell>
                <span className="text-sm text-[var(--color-text-primary)]">{material.preferredVendorName || "-"}</span>
              </EnterpriseTableCell>

              <EnterpriseTableCell align="right">
                ${material.standardCost.toFixed(2)}
              </EnterpriseTableCell>

              <EnterpriseTableCell align="right">
                <div className="inline-flex items-center gap-1">
                  <IconLink href={`/materials/${material.id}`} icon={<Eye size={15} />} label="View material" variant="ghost" size="sm" />
                  <IconLink href={`/materials/${material.id}/edit`} icon={<Pencil size={15} />} label="Edit material" variant="ghost" size="sm" />
                </div>
              </EnterpriseTableCell>
            </EnterpriseTableRow>
          ))}
        </EnterpriseTableBody>
      </EnterpriseTable>

      <EnterpriseTableFooter>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Showing {showingFrom}-{showingTo} of {total}
          </p>

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
