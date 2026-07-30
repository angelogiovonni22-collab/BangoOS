"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { VendorsFilters, VendorsTable } from "@/components/vendors";
import { Button, EmptyState, ErrorState, PageHeader, SkeletonLoader, SummaryCard } from "@/components/ui";
import { useCompany } from "@/lib/company";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { VendorListItem, VendorSortKey, VendorStatus } from "@/lib/vendors";

const PAGE_SIZE = 10;

export function VendorsListClient() {
  const supabase = useMemo(() => createClient(), []);
  const { companyName } = useCompany();

  const [items, setItems] = useState<VendorListItem[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<VendorStatus | "all">("all");
  const [preferred, setPreferred] = useState<"all" | "preferred" | "standard">("all");
  const [sortBy, setSortBy] = useState<VendorSortKey>("display_name_asc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      if (!supabase) {
        if (active) {
          setErrorMessage("Unable to connect right now. Please try again shortly.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const workspace = await resolveWorkspaceContext(supabase);

        if (!workspace.context) {
          if (active) {
            setErrorMessage(workspace.errorMessage || "Unable to verify your workspace.");
            setIsLoading(false);
          }
          return;
        }

        let request = supabase
          .from("vendors")
          .select(
            "id, vendor_code, company_name, display_name, status, preferred_vendor, payment_terms, first_name, last_name, email, phone, quality_rating, delivery_rating, created_at",
            { count: "exact" },
          )
          .eq("company_id", workspace.context.companyId);

        if (query.trim()) {
          const sanitizedQuery = query.trim().replace(/,/g, " ");
          request = request.or(
            `vendor_code.ilike.%${sanitizedQuery}%,company_name.ilike.%${sanitizedQuery}%,display_name.ilike.%${sanitizedQuery}%,first_name.ilike.%${sanitizedQuery}%,last_name.ilike.%${sanitizedQuery}%,email.ilike.%${sanitizedQuery}%`,
          );
        }

        if (status !== "all") {
          request = request.eq("status", status);
        }

        if (preferred === "preferred") {
          request = request.eq("preferred_vendor", true);
        }

        if (preferred === "standard") {
          request = request.eq("preferred_vendor", false);
        }

        switch (sortBy) {
          case "display_name_desc":
            request = request.order("display_name", { ascending: false });
            break;
          case "vendor_code_asc":
            request = request.order("vendor_code", { ascending: true });
            break;
          case "status_asc":
            request = request.order("status", { ascending: true }).order("display_name", { ascending: true });
            break;
          case "quality_desc":
            request = request.order("quality_rating", { ascending: false, nullsFirst: false }).order("display_name", { ascending: true });
            break;
          case "created_at_desc":
            request = request.order("created_at", { ascending: false });
            break;
          case "display_name_asc":
          default:
            request = request.order("display_name", { ascending: true });
            break;
        }

        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, count, error } = await request.range(from, to);

        if (error) {
          if (active) {
            setErrorMessage(error.message);
            setIsLoading(false);
          }
          return;
        }

        if (!active) {
          return;
        }

        const mapped = (data ?? []).map((row) => {
          const firstName = row.first_name?.trim() || "";
          const lastName = row.last_name?.trim() || "";

          return {
            id: row.id,
            vendorCode: row.vendor_code,
            companyName: row.company_name,
            displayName: row.display_name,
            status: row.status as VendorStatus,
            preferredVendor: row.preferred_vendor,
            paymentTerms: row.payment_terms,
            contactName: [firstName, lastName].filter(Boolean).join(" "),
            email: row.email,
            phone: row.phone,
            qualityRating: row.quality_rating,
            deliveryRating: row.delivery_rating,
            createdAt: row.created_at,
          } as VendorListItem;
        });

        setItems(mapped);
        setTotal(count || 0);
      } catch (error) {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load vendors.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [page, preferred, query, sortBy, status, supabase]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const activeFilters = useMemo(() => {
    let count = 0;

    if (query.trim()) {
      count += 1;
    }

    if (status !== "all") {
      count += 1;
    }

    if (preferred !== "all") {
      count += 1;
    }

    return count;
  }, [preferred, query, status]);

  const summary = useMemo(() => {
    const preferredCount = items.filter((item) => item.preferredVendor).length;
    const activeCount = items.filter((item) => item.status === "active").length;

    const avgQuality = items.filter((item) => item.qualityRating !== null);
    const quality = avgQuality.length > 0
      ? avgQuality.reduce((acc, item) => acc + (item.qualityRating || 0), 0) / avgQuality.length
      : 0;

    return {
      preferredCount,
      activeCount,
      quality,
    };
  }, [items]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonLoader className="h-10 w-80" />
        <SkeletonLoader className="h-36 w-full" />
        <SkeletonLoader className="h-72 w-full" />
      </div>
    );
  }

  if (errorMessage) {
    return <ErrorState title="Unable to load vendors" description={errorMessage} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Supply Chain"
        title="Vendors"
        description={`Manage vendor relationships for ${companyName || "your company"}.`}
        primaryAction={
          <Link href="/vendors/new">
            <Button>
              <Plus size={16} />
              New vendor
            </Button>
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={<span>V</span>} label="Total loaded" value={String(total)} context="Across current filters" tone="brand" />
        <SummaryCard icon={<span>*</span>} label="Preferred in view" value={String(summary.preferredCount)} context="Starred vendors" tone="warning" />
        <SummaryCard icon={<span>Q</span>} label="Average quality" value={summary.quality > 0 ? summary.quality.toFixed(1) : "-"} context="0 to 5 rating scale" tone="info" />
      </section>

      <VendorsFilters
        query={query}
        status={status}
        preferred={preferred}
        sortBy={sortBy}
        onQueryChange={(value) => {
          setQuery(value);
          setPage(1);
        }}
        onStatusChange={(value) => {
          setStatus(value);
          setPage(1);
        }}
        onPreferredChange={(value) => {
          setPreferred(value);
          setPage(1);
        }}
        onSortByChange={(value) => {
          setSortBy(value);
          setPage(1);
        }}
        activeFilters={activeFilters}
      />

      {items.length === 0 ? (
        <EmptyState
          title="No vendors found"
          description="Try different filters or create your first vendor record."
          action={
            <Link href="/vendors/new">
              <Button>New vendor</Button>
            </Link>
          }
        />
      ) : (
        <VendorsTable
          items={items}
          total={total}
          page={Math.min(page, totalPages)}
          pageSize={PAGE_SIZE}
          onPageChange={(nextPage) => setPage(Math.max(1, Math.min(nextPage, totalPages)))}
        />
      )}
    </div>
  );
}
