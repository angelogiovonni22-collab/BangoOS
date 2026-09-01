import Link from "next/link";
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
import type { CostCodeListItem } from "@/lib/cost-codes";

type CostCodesTableProps = {
  items: CostCodeListItem[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export function CostCodesTable({ items, total, page, pageSize, onPageChange }: CostCodesTableProps) {
  const router = useRouter();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = total === 0 ? 0 : Math.min(total, page * pageSize);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <TableContainer
      title="Cost Code Directory"
      description="Standardize budgeting and cost tracking across divisions, categories, and trades."
    >
      <EnterpriseTable ariaLabel="Cost code directory table">
        <EnterpriseTableHead>
          <tr>
            <EnterpriseTableHeading>Cost code</EnterpriseTableHeading>
            <EnterpriseTableHeading>Status</EnterpriseTableHeading>
            <EnterpriseTableHeading>Classification</EnterpriseTableHeading>
            <EnterpriseTableHeading>Hierarchy</EnterpriseTableHeading>
            <EnterpriseTableHeading align="right">Budget</EnterpriseTableHeading>
            <EnterpriseTableHeading align="right">Committed</EnterpriseTableHeading>
            <EnterpriseTableHeading align="right">Actual</EnterpriseTableHeading>
            <EnterpriseTableHeading align="right">Actions</EnterpriseTableHeading>
          </tr>
        </EnterpriseTableHead>

        <EnterpriseTableBody>
          {items.map((costCode) => (
            <EnterpriseTableRow
              key={costCode.id}
              className="cursor-pointer"
              role="link"
              tabIndex={0}
              aria-label={`Open cost code ${costCode.code}`}
              onClick={(event) => {
                const target = event.target as HTMLElement;

                if (target.closest("a,button,input,select,textarea")) {
                  return;
                }

                router.push(`/cost-codes/${costCode.id}`);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") {
                  return;
                }

                event.preventDefault();
                router.push(`/cost-codes/${costCode.id}`);
              }}
            >
              <EnterpriseTableCell>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{costCode.code}</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{costCode.name}</p>
              </EnterpriseTableCell>

              <EnterpriseTableCell>
                <StatusBadge status={costCode.status} />
              </EnterpriseTableCell>

              <EnterpriseTableCell>
                <p className="text-sm text-[var(--color-text-primary)]">{costCode.division || "-"}</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{costCode.category || costCode.trade || "Unclassified"}</p>
              </EnterpriseTableCell>

              <EnterpriseTableCell>
                {costCode.parentLabel ? (
                  <Badge tone="info">Child of {costCode.parentLabel}</Badge>
                ) : costCode.hasChildren ? (
                  <Badge tone="brand">Parent</Badge>
                ) : (
                  <Badge tone="neutral">Standalone</Badge>
                )}
              </EnterpriseTableCell>

              <EnterpriseTableCell align="right">${costCode.budget.toFixed(2)}</EnterpriseTableCell>
              <EnterpriseTableCell align="right">${costCode.committedCost.toFixed(2)}</EnterpriseTableCell>
              <EnterpriseTableCell align="right">${costCode.actualCost.toFixed(2)}</EnterpriseTableCell>

              <EnterpriseTableCell align="right">
                <div className="inline-flex items-center gap-1">
                  <IconLink href={`/cost-codes/${costCode.id}`} icon={<Eye size={15} />} label="View cost code" variant="ghost" size="sm" />
                  <IconLink href={`/cost-codes/${costCode.id}/edit`} icon={<Pencil size={15} />} label="Edit cost code" variant="ghost" size="sm" />
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
