import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Eye, Pencil, Star } from "lucide-react";
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
import type { VendorListItem } from "@/lib/vendors";

type VendorsTableProps = {
  items: VendorListItem[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export function VendorsTable({ items, total, page, pageSize, onPageChange }: VendorsTableProps) {
  const router = useRouter();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = total === 0 ? 0 : Math.min(total, page * pageSize);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <TableContainer
      title="Vendor Directory"
      description="Manage supplier records, performance, and payment preferences."
    >
      <EnterpriseTable ariaLabel="Vendor directory table">
        <EnterpriseTableHead>
          <tr>
            <EnterpriseTableHeading>Vendor</EnterpriseTableHeading>
            <EnterpriseTableHeading>Code</EnterpriseTableHeading>
            <EnterpriseTableHeading>Status</EnterpriseTableHeading>
            <EnterpriseTableHeading>Primary contact</EnterpriseTableHeading>
            <EnterpriseTableHeading>Payment terms</EnterpriseTableHeading>
            <EnterpriseTableHeading>Ratings</EnterpriseTableHeading>
            <EnterpriseTableHeading align="right">Actions</EnterpriseTableHeading>
          </tr>
        </EnterpriseTableHead>

        <EnterpriseTableBody>
          {items.map((vendor) => (
            <EnterpriseTableRow
              key={vendor.id}
              className="cursor-pointer"
              role="link"
              tabIndex={0}
              aria-label={`Open vendor ${vendor.displayName}`}
              onClick={(event) => {
                const target = event.target as HTMLElement;

                if (target.closest("a,button,input,select,textarea")) {
                  return;
                }

                router.push(`/vendors/${vendor.id}`);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") {
                  return;
                }

                event.preventDefault();
                router.push(`/vendors/${vendor.id}`);
              }}
            >
              <EnterpriseTableCell>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">{vendor.displayName}</span>
                  {vendor.preferredVendor ? <Star size={14} className="fill-amber-400 text-amber-500" aria-label="Preferred vendor" /> : null}
                </div>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{vendor.companyName}</p>
              </EnterpriseTableCell>

              <EnterpriseTableCell>{vendor.vendorCode}</EnterpriseTableCell>

              <EnterpriseTableCell>
                <StatusBadge status={vendor.status} />
              </EnterpriseTableCell>

              <EnterpriseTableCell>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{vendor.contactName || "Not set"}</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{vendor.email || vendor.phone || "-"}</p>
              </EnterpriseTableCell>

              <EnterpriseTableCell>{vendor.paymentTerms || "-"}</EnterpriseTableCell>

              <EnterpriseTableCell>
                <div className="flex items-center gap-2">
                  <Badge tone="info">Q {vendor.qualityRating?.toFixed(1) ?? "-"}</Badge>
                  <Badge tone="brand">D {vendor.deliveryRating?.toFixed(1) ?? "-"}</Badge>
                </div>
              </EnterpriseTableCell>

              <EnterpriseTableCell align="right">
                <div className="inline-flex items-center gap-1">
                  <IconLink href={`/vendors/${vendor.id}`} icon={<Eye size={15} />} label="View vendor" variant="ghost" size="sm" />
                  <IconLink href={`/vendors/${vendor.id}/edit`} icon={<Pencil size={15} />} label="Edit vendor" variant="ghost" size="sm" />
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
