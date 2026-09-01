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
import { formatPercent, formatUsdCurrency, type LaborRateListItem } from "@/lib/labor-rates";

type LaborRatesTableProps = {
  items: LaborRateListItem[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export function LaborRatesTable({ items, total, page, pageSize, onPageChange }: LaborRatesTableProps) {
  const router = useRouter();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = total === 0 ? 0 : Math.min(total, page * pageSize);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <TableContainer
      title="Labor Rate Directory"
      description="Maintain reusable labor cost and billable pricing standards for your company."
    >
      <EnterpriseTable ariaLabel="Labor rate directory table">
        <EnterpriseTableHead>
          <tr>
            <EnterpriseTableHeading>Code</EnterpriseTableHeading>
            <EnterpriseTableHeading>Name</EnterpriseTableHeading>
            <EnterpriseTableHeading>Trade</EnterpriseTableHeading>
            <EnterpriseTableHeading>Skill</EnterpriseTableHeading>
            <EnterpriseTableHeading align="right">Base Rate</EnterpriseTableHeading>
            <EnterpriseTableHeading align="right">Burden</EnterpriseTableHeading>
            <EnterpriseTableHeading align="right">True Cost</EnterpriseTableHeading>
            <EnterpriseTableHeading align="right">Billable Rate</EnterpriseTableHeading>
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
              aria-label={`Open labor rate ${item.code}`}
              onClick={(event) => {
                const target = event.target as HTMLElement;

                if (target.closest("a,button,input,select,textarea")) {
                  return;
                }

                router.push(`/labor-rates/${item.id}`);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") {
                  return;
                }

                event.preventDefault();
                router.push(`/labor-rates/${item.id}`);
              }}
            >
              <EnterpriseTableCell>{item.code}</EnterpriseTableCell>

              <EnterpriseTableCell>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{item.name}</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{item.defaultCostCodeLabel || "No default cost code"}</p>
              </EnterpriseTableCell>

              <EnterpriseTableCell>{item.trade || "-"}</EnterpriseTableCell>
              <EnterpriseTableCell>{item.skillLevel || "-"}</EnterpriseTableCell>

              <EnterpriseTableCell align="right">{formatUsdCurrency(item.baseHourlyRate)}</EnterpriseTableCell>
              <EnterpriseTableCell align="right">
                <div className="flex flex-col items-end gap-1">
                  <span>{formatUsdCurrency(item.totalBurdenHourly)}</span>
                  <Badge tone="neutral">{formatPercent(item.baseHourlyRate > 0 ? (item.totalBurdenHourly / item.baseHourlyRate) * 100 : 0)}</Badge>
                </div>
              </EnterpriseTableCell>
              <EnterpriseTableCell align="right">{formatUsdCurrency(item.trueHourlyCost)}</EnterpriseTableCell>
              <EnterpriseTableCell align="right">{formatUsdCurrency(item.billableHourlyRate)}</EnterpriseTableCell>

              <EnterpriseTableCell>
                <StatusBadge status={item.status} />
              </EnterpriseTableCell>

              <EnterpriseTableCell>{new Date(item.updatedAt).toLocaleDateString()}</EnterpriseTableCell>

              <EnterpriseTableCell align="right">
                <div className="inline-flex items-center gap-1">
                  <IconLink href={`/labor-rates/${item.id}`} icon={<Eye size={15} />} label="View labor rate" variant="ghost" size="sm" />
                  <IconLink href={`/labor-rates/${item.id}/edit`} icon={<Pencil size={15} />} label="Edit labor rate" variant="ghost" size="sm" />
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
