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
  StatusBadge,
  TableContainer,
  IconLink,
} from "@/components/ui";
import type { UnitListItem } from "@/lib/units-of-measure";
import { UnitCategoryBadge } from "./unit-category-badge";
import { UnitSystemBadge } from "./unit-system-badge";

type UnitTableProps = {
  items: UnitListItem[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function formatConversion(item: UnitListItem) {
  if (!item.base_unit_id || !item.conversion_factor || !item.baseUnitCode) {
    return "-";
  }

  return `1 ${item.code} = ${item.conversion_factor} ${item.baseUnitCode}`;
}

export function UnitTable({ items, total, page, pageSize, onPageChange }: UnitTableProps) {
  const router = useRouter();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = total === 0 ? 0 : Math.min(total, page * pageSize);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <TableContainer title="Units of Measure" description="Centralized system and company unit library.">
      <EnterpriseTable ariaLabel="Units of measure table">
        <EnterpriseTableHead>
          <tr>
            <EnterpriseTableHeading>Code</EnterpriseTableHeading>
            <EnterpriseTableHeading>Name</EnterpriseTableHeading>
            <EnterpriseTableHeading>Symbol</EnterpriseTableHeading>
            <EnterpriseTableHeading>Category</EnterpriseTableHeading>
            <EnterpriseTableHeading>Measurement</EnterpriseTableHeading>
            <EnterpriseTableHeading>Unit Type</EnterpriseTableHeading>
            <EnterpriseTableHeading>Base Unit</EnterpriseTableHeading>
            <EnterpriseTableHeading>Conversion</EnterpriseTableHeading>
            <EnterpriseTableHeading align="right">Precision</EnterpriseTableHeading>
            <EnterpriseTableHeading>Source</EnterpriseTableHeading>
            <EnterpriseTableHeading>Status</EnterpriseTableHeading>
            <EnterpriseTableHeading>Updated</EnterpriseTableHeading>
            <EnterpriseTableHeading align="right">Actions</EnterpriseTableHeading>
          </tr>
        </EnterpriseTableHead>

        <EnterpriseTableBody>
          {items.map((item) => (
            <EnterpriseTableRow
              key={item.id}
              className="cursor-pointer"
              role="link"
              tabIndex={0}
              aria-label={`Open unit ${item.code}`}
              onClick={(event) => {
                const target = event.target as HTMLElement;

                if (target.closest("a,button,input,select,textarea")) {
                  return;
                }

                router.push(`/units-of-measure/${item.id}`);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") {
                  return;
                }

                event.preventDefault();
                router.push(`/units-of-measure/${item.id}`);
              }}
            >
              <EnterpriseTableCell>{item.code}</EnterpriseTableCell>
              <EnterpriseTableCell>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{item.name}</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{item.plural_name || "-"}</p>
              </EnterpriseTableCell>
              <EnterpriseTableCell>{item.symbol || "-"}</EnterpriseTableCell>
              <EnterpriseTableCell><UnitCategoryBadge category={item.category as never} /></EnterpriseTableCell>
              <EnterpriseTableCell>{item.measurement_system}</EnterpriseTableCell>
              <EnterpriseTableCell>{item.unit_type}</EnterpriseTableCell>
              <EnterpriseTableCell>{item.baseUnitCode ? `${item.baseUnitCode} - ${item.baseUnitName || ""}` : "-"}</EnterpriseTableCell>
              <EnterpriseTableCell>{formatConversion(item)}</EnterpriseTableCell>
              <EnterpriseTableCell align="right">{item.decimal_precision}</EnterpriseTableCell>
              <EnterpriseTableCell><UnitSystemBadge isSystem={item.is_system} /></EnterpriseTableCell>
              <EnterpriseTableCell><StatusBadge status={item.is_active ? "active" : "inactive"} /></EnterpriseTableCell>
              <EnterpriseTableCell>{formatDate(item.updated_at)}</EnterpriseTableCell>
              <EnterpriseTableCell align="right">
                <div className="inline-flex items-center gap-1">
                  <IconLink href={`/units-of-measure/${item.id}`} icon={<Eye size={15} />} label="View unit" variant="ghost" size="sm" />
                  {item.is_system ? (
                    <span className="text-xs text-[var(--color-text-muted)]">System</span>
                  ) : (
                    <IconLink href={`/units-of-measure/${item.id}/edit`} icon={<Pencil size={15} />} label="Edit unit" variant="ghost" size="sm" />
                  )}
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
