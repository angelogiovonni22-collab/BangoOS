  "use client";

  import Link from "next/link";
  import { useParams } from "next/navigation";
  import { type ReactNode, useEffect, useMemo, useState } from "react";
  import {
    Building2,
    CalendarDays,
    Camera,
    CreditCard,
    Globe,
    History,
    ReceiptText,
    StickyNote,
    UserRound,
  } from "lucide-react";
  import { CustomerAvatar } from "@/components/customers";
  import {
    Badge,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    EmptyState,
    ErrorState,
    EnterpriseTable,
    EnterpriseTableBody,
    EnterpriseTableCell,
    EnterpriseTableHead,
    EnterpriseTableHeading,
    EnterpriseTableRow,
    SkeletonLoader,
    SummaryCard,
  } from "@/components/ui";
  import { useI18n } from "@/lib/i18n/provider";
  import {
    formatProjectCurrency,
    formatProjectDate,
    normalizeProjectStatus,
    type ProjectRow,
  } from "@/lib/projects";
  import { EstimateStatusBadge } from "@/components/estimates";
  import { InvoiceStatusBadge } from "@/components/invoices";
  import { ProjectStatusBadge } from "@/components/projects";
  import { createOrionTimelineService, formatTimelineOccurredAt, formatTimelineText, type OrionTimelineItem } from "@/lib/orion/timeline";
  import { createClient } from "@/lib/supabase/client";
  import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
  import type { Database } from "@/types/database.types";

  type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
  type EstimateRow = Database["public"]["Tables"]["estimates"]["Row"];
  type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
  type ProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "first_name" | "last_name" | "role">;

  type RelatedProject = Pick<
    ProjectRow,
    | "id"
    | "name"
    | "project_number"
    | "status"
    | "estimated_start_date"
    | "estimated_cost"
    | "contract_amount"
    | "address_line_1"
    | "address_line_2"
    | "city"
    | "state"
    | "postal_code"
    | "created_at"
  >;

  type RelatedEstimate = Pick<EstimateRow, "id" | "estimate_number" | "title" | "status" | "issue_date" | "total_amount" | "project_id" | "created_at">;
  type RelatedInvoice = Pick<InvoiceRow, "id" | "invoice_number" | "title" | "status" | "issue_date" | "due_date" | "total_amount" | "amount_paid" | "project_id" | "created_at">;
  type RelatedChangeOrder = Pick<
    Database["public"]["Tables"]["change_orders"]["Row"],
    "id" | "change_order_number" | "title" | "status" | "requested_date" | "total_amount" | "project_id" | "created_at"
  >;
  type RelatedPhoto = Pick<Database["public"]["Tables"]["project_photos"]["Row"], "id" | "project_id" | "original_filename" | "category" | "captured_at" | "created_at" | "note">;

  type CustomerProfile = {
    customer: CustomerRow;
    customerName: string;
    customerTypeLabel: string;
    customerTypeKey: "residential" | "commercial";
    statusLabel: string;
    statusKey: string;
    primaryContactName: string;
    accountOwnerName: string;
    accountOwnerRole: string;
    address: string;
    customerSince: string;
    contactEmail: string;
    contactPhone: string;
    notes: string;
    activeProjects: RelatedProject[];
    currentProject: RelatedProject | null;
    estimates: RelatedEstimate[];
    invoices: RelatedInvoice[];
    changeOrders: RelatedChangeOrder[];
    photos: RelatedPhoto[];
    outstandingBalance: number;
    approvedEstimateCount: number;
    tags: string[];
  };

  type ProfileTab = "overview" | "projects" | "estimates" | "invoices" | "change-orders" | "documents" | "photos" | "notes" | "timeline";
  const PROFILE_TABS: Array<{ key: ProfileTab; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "projects", label: "Projects" },
    { key: "estimates", label: "Estimates" },
    { key: "invoices", label: "Invoices" },
    { key: "change-orders", label: "Change Orders" },
    { key: "documents", label: "Documents" },
    { key: "photos", label: "Photos" },
    { key: "notes", label: "Notes" },
    { key: "timeline", label: "Timeline" },
  ];

  export default function CustomerDetailsPage() {
    const { t, locale } = useI18n();
    const params = useParams<{ id?: string | string[] }>();
    const customerId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
    const supabase = useMemo(() => createClient(), []);

    const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
    const [projectsError, setProjectsError] = useState<string | null>(null);
    const [estimatesError, setEstimatesError] = useState<string | null>(null);
    const [invoicesError, setInvoicesError] = useState<string | null>(null);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [estimatesLoading, setEstimatesLoading] = useState(false);
    const [invoicesLoading, setInvoicesLoading] = useState(false);
    const [timelineItems, setTimelineItems] = useState<OrionTimelineItem[]>([]);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [timelineError, setTimelineError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [activeTab, setActiveTab] = useState<ProfileTab>("overview");

    useEffect(() => {
      let isSubscribed = true;

      const loadCustomer = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        setNotFound(false);
        setCustomerProfile(null);
        setProjectsError(null);
        setEstimatesError(null);
        setInvoicesError(null);
        setTimelineItems([]);
        setTimelineError(null);
        setTimelineLoading(true);

        if (!supabase) {
          if (isSubscribed) {
            setErrorMessage(t("customers.errorConnect"));
            setIsLoading(false);
          }

          return;
        }

        if (!customerId) {
          if (isSubscribed) {
            setErrorMessage(t("customers.errorReadCustomerId"));
            setIsLoading(false);
          }

          return;
        }

        try {
          const workspace = await resolveWorkspaceContext(supabase);

          if (workspace.errorMessage || !workspace.context) {
            if (isSubscribed) {
              setErrorMessage(resolveWorkspaceError(workspace.errorCode, workspace.errorMessage, t));
              setIsLoading(false);
            }

            return;
          }

          const [customerResult, profilesResult] = await Promise.all([
            supabase
              .from("customers")
              .select(
                "id, company_id, customer_type, first_name, last_name, company_name, email, phone, address_line_1, address_line_2, city, state, postal_code, notes, status, created_at, updated_at, created_by",
              )
              .eq("id", customerId)
              .eq("company_id", workspace.context.companyId)
              .maybeSingle<CustomerRow>(),
            supabase
              .from("profiles")
              .select("id, first_name, last_name, role")
              .eq("company_id", workspace.context.companyId)
              .order("first_name", { ascending: true }),
          ]);

          if (customerResult.error) {
            if (isSubscribed) {
              setErrorMessage(t("customers.errorLoadCustomer"));
              setIsLoading(false);
            }

            return;
          }

          if (!customerResult.data) {
            if (isSubscribed) {
              setNotFound(true);
              setIsLoading(false);
            }

            return;
          }

          const customer = customerResult.data;
          const profileMap = new Map<string, string>();

          (profilesResult.data ?? []).forEach((profile) => {
            const row = profile as ProfileRow;
            profileMap.set(row.id, getDisplayName(row.first_name, row.last_name, t("customers.notProvided")));
          });

          const customerName = getCustomerName(customer);
          const customerTypeKey = getCustomerTypeKey(customer.customer_type);
          const customerTypeLabel = customerTypeKey === "commercial" ? `${t("customers.typeCommercial")} Customer` : `${t("customers.typeResidential")} Customer`;
          const statusKey = getCustomerStatusKey(customer.status);
          const statusLabel = getCustomerStatusLabel(statusKey, t);
          const address = formatCustomerAddress(customer);
          const accountOwnerName = customer.created_by ? profileMap.get(customer.created_by) || t("customers.notProvided") : t("customers.notProvided");
          const accountOwnerRole = customer.created_by ? getDisplayNameFromRole((profilesResult.data ?? []).find((profile) => profile.id === customer.created_by)?.role) : t("customers.notProvided");
          const customerSince = formatDate(customer.created_at, localeTag(locale), t("customers.notProvided"));
          const contactEmail = customer.email?.trim() || "";
          const contactPhone = customer.phone?.trim() || "";
          const notes = customer.notes?.trim() || "";

          const [projectsResult, estimatesResult, invoicesResult, changeOrdersResult] = await Promise.all([
            supabase
              .from("projects")
              .select(
                "id, name, project_number, status, estimated_start_date, estimated_cost, contract_amount, address_line_1, address_line_2, city, state, postal_code, created_at",
              )
              .eq("company_id", workspace.context.companyId)
              .eq("customer_id", customerId)
              .order("created_at", { ascending: false }),
            supabase
              .from("estimates")
              .select("id, estimate_number, title, status, issue_date, total_amount, project_id, created_at")
              .eq("company_id", workspace.context.companyId)
              .eq("customer_id", customerId)
              .order("created_at", { ascending: false }),
            supabase
              .from("invoices")
              .select("id, invoice_number, title, status, issue_date, due_date, total_amount, amount_paid, project_id, created_at")
              .eq("company_id", workspace.context.companyId)
              .eq("customer_id", customerId)
              .order("created_at", { ascending: false }),
            supabase
              .from("change_orders")
              .select("id, change_order_number, title, status, requested_date, total_amount, project_id, created_at")
              .eq("company_id", workspace.context.companyId)
              .eq("customer_id", customerId)
              .order("created_at", { ascending: false }),
          ]);

          const mappedProjects: RelatedProject[] = projectsResult.data ? (projectsResult.data as RelatedProject[]) : [];
          const mappedEstimates: RelatedEstimate[] = estimatesResult.data ? (estimatesResult.data as RelatedEstimate[]) : [];
          const mappedInvoices: RelatedInvoice[] = invoicesResult.data ? (invoicesResult.data as RelatedInvoice[]) : [];
          const mappedChangeOrders: RelatedChangeOrder[] = changeOrdersResult.data ? (changeOrdersResult.data as RelatedChangeOrder[]) : [];
          const projectIds = mappedProjects.map((project) => project.id);
          const photosResult = projectIds.length > 0
            ? await supabase
                .from("project_photos")
                .select("id, project_id, original_filename, category, captured_at, created_at, note")
                .eq("company_id", workspace.context.companyId)
                .in("project_id", projectIds)
                .order("captured_at", { ascending: false })
                .order("created_at", { ascending: false })
            : { data: [], error: null };

          let resolvedTimeline: OrionTimelineItem[] = [];

          try {
            const timelineService = createOrionTimelineService(supabase);
            const timelineResult = await timelineService.listCustomerTimeline(workspace.context.companyId, customerId, {
              pageSize: 20,
              includeLegacyAdapters: false,
            });
            resolvedTimeline = timelineResult.items;
          } catch {
            resolvedTimeline = [];
          }

          if (isSubscribed) {
            if (projectsResult.error) {
              setProjectsError(t("customers.errorLoadProjects"));
            }

            if (estimatesResult.error) {
              setEstimatesError(t("customers.errorLoadEstimates"));
            }

            if (invoicesResult.error) {
              setInvoicesError(t("customers.errorLoadInvoices"));
            }

            if (photosResult.error) {
              setTimelineError("Some related records could not be loaded.");
            }

            const activeProjects = mappedProjects.filter((project) => isActiveProjectStatus(project.status));
            const currentProject = activeProjects[0] ?? mappedProjects[0] ?? null;
            const outstandingBalance = mappedInvoices.reduce((total, invoice) => total + Math.max(invoice.total_amount - invoice.amount_paid, 0), 0);
            const approvedEstimateCount = mappedEstimates.filter((estimate) => estimate.status === "approved").length;

            setCustomerProfile({
              customer,
              customerName,
              customerTypeKey,
              customerTypeLabel,
              statusKey,
              statusLabel,
              primaryContactName: customerName,
              accountOwnerName,
              accountOwnerRole,
              address,
              customerSince,
              contactEmail,
              contactPhone,
              notes,
              activeProjects,
              currentProject,
              estimates: mappedEstimates,
              invoices: mappedInvoices,
              changeOrders: mappedChangeOrders,
              photos: (photosResult.data ?? []) as RelatedPhoto[],
              outstandingBalance,
              approvedEstimateCount,
              tags: buildCustomerTags({ customerTypeLabel, statusLabel, activeProjects, notes }),
            });

            setTimelineItems(resolvedTimeline);
            setTimelineLoading(false);

            setProjectsLoading(false);
            setEstimatesLoading(false);
            setInvoicesLoading(false);
            setIsLoading(false);
          }
        } catch (caughtError) {
          console.error("Load customer error:", caughtError);

          if (isSubscribed) {
            setErrorMessage(t("customers.errorLoadCustomerUnexpected"));
            setTimelineLoading(false);
            setIsLoading(false);
          }
        }
      };

      void loadCustomer();

      return () => {
        isSubscribed = false;
      };
    }, [customerId, locale, supabase, t]);

    if (isLoading) {
      return <CustomerLoadingState />;
    }

    if (errorMessage) {
      return <CustomerErrorState message={errorMessage} />;
    }

    if (notFound || !customerProfile) {
      return <CustomerNotFoundState />;
    }

    const tabContent = renderTabContent({
      activeTab,
      profile: customerProfile,
      locale,
      t,
      projectsLoading,
      projectsError,
      estimatesLoading,
      estimatesError,
      invoicesLoading,
      invoicesError,
      timelineItems,
      timelineLoading,
      timelineError,
    });

    const lifetimeRevenue = customerProfile.invoices.reduce((sum, invoice) => sum + Math.max(invoice.amount_paid, 0), 0);

    return (
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[var(--radius-3xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] shadow-[var(--shadow-large)]">
          <div className="bg-[linear-gradient(135deg,rgba(37,99,235,0.08),rgba(6,182,212,0.06),transparent)] px-6 py-6 sm:px-7 sm:py-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
                  <Link href="/customers" className="text-[var(--color-brand-700)] transition hover:text-[var(--color-brand-800)]">
                    Customers
                  </Link>
                  <span>/</span>
                  <span className="truncate">Customer Workspace</span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <CustomerAvatar name={customerProfile.customerName} className="h-16 w-16 text-base" />
                  <div className="min-w-0">
                    <h1 className="truncate text-3xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-5xl">{customerProfile.customerName}</h1>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge tone={customerProfile.statusKey === "active" ? "success" : customerProfile.statusKey === "archived" ? "neutral" : "warning"}>
                        {customerProfile.statusLabel}
                      </Badge>
                      <Badge tone={customerProfile.customerTypeKey === "commercial" ? "brand" : "success"}>
                        {formatCustomerTypeLabel(customerProfile.customerTypeLabel)}
                      </Badge>
                    </div>
                  </div>
                </div>

                <p className="max-w-3xl text-base leading-7 text-[var(--color-text-secondary)] sm:text-lg">
                  Manage the customer relationship, track projects and billing, and review the latest activity in one workspace.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start lg:justify-end">
                <Link
                  href={`/customers/${customerProfile.customer.id}/edit`}
                  className="inline-flex h-11 items-center rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white px-4 text-sm font-semibold text-[var(--color-text-primary)] shadow-[var(--shadow-small)] transition-all duration-200 hover:-translate-y-px hover:bg-[var(--color-surface-subtle)]"
                >
                  Edit
                </Link>
                <Link
                  href={`/estimates/new?customerId=${customerProfile.customer.id}`}
                  className="inline-flex h-11 items-center rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white px-4 text-sm font-semibold text-[var(--color-text-primary)] shadow-[var(--shadow-small)] transition-all duration-200 hover:-translate-y-px hover:bg-[var(--color-surface-subtle)]"
                >
                  New Estimate
                </Link>
                <Link
                  href={`/projects/new?customerId=${customerProfile.customer.id}`}
                  className="inline-flex h-11 items-center rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white px-4 text-sm font-semibold text-[var(--color-text-primary)] shadow-[var(--shadow-small)] transition-all duration-200 hover:-translate-y-px hover:bg-[var(--color-surface-subtle)]"
                >
                  New Project
                </Link>
                <Link
                  href={`/invoices/new?customerId=${customerProfile.customer.id}${customerProfile.currentProject ? `&projectId=${customerProfile.currentProject.id}` : ""}`}
                  className="inline-flex h-11 items-center rounded-[var(--radius-lg)] bg-[var(--color-brand-600)] px-4 text-sm font-semibold text-white shadow-[0_12px_26px_-16px_rgba(37,99,235,0.75)] transition-all duration-200 hover:-translate-y-px hover:bg-[var(--color-brand-700)] hover:shadow-[0_16px_30px_-14px_rgba(37,99,235,0.85)]"
                >
                  New Invoice
                </Link>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard icon={<CreditCard size={16} aria-hidden="true" />} label="Lifetime Revenue" value={formatProjectCurrency(lifetimeRevenue, localeTag(locale), "$0")} context={customerProfile.invoices.length > 0 ? "Calculated from recorded invoice payments" : "No revenue data available yet"} tone="brand" />
              <SummaryCard icon={<Building2 size={16} aria-hidden="true" />} label="Active Projects" value={String(customerProfile.activeProjects.length)} context={customerProfile.activeProjects.length > 0 ? "Currently active work" : "No active projects"} tone="success" />
              <SummaryCard icon={<CreditCard size={16} aria-hidden="true" />} label="Outstanding Balance" value={formatProjectCurrency(customerProfile.outstandingBalance, localeTag(locale), "$0")} context={customerProfile.outstandingBalance > 0 ? "Balance due" : "No outstanding balance"} tone="warning" />
              <SummaryCard icon={<CalendarDays size={16} aria-hidden="true" />} label="Member Since" value={customerProfile.customerSince} context="Customer record creation date" tone="info" />
            </div>
          </div>
        </section>

        <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-1.5 shadow-[var(--shadow-small)]">
          <nav className="flex gap-1.5 overflow-x-auto p-1" aria-label="Customer workspace tabs">
            {PROFILE_TABS.map((tab) => {
              const active = tab.key === activeTab;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`whitespace-nowrap rounded-[var(--radius-lg)] border-b-2 px-4 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)] ${
                    active
                      ? "border-[var(--color-brand-600)] text-[var(--color-brand-700)]"
                      : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                  aria-selected={active}
                  role="tab"
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </section>

        <div role="tabpanel" aria-label={PROFILE_TABS.find((tab) => tab.key === activeTab)?.label || "Customer workspace section"}>
          {tabContent}
        </div>
      </div>
    );
  }

  function renderTabContent({
    activeTab,
    profile,
    locale,
    t,
    projectsLoading,
    projectsError,
    estimatesLoading,
    estimatesError,
    invoicesLoading,
    invoicesError,
    timelineItems,
    timelineLoading,
    timelineError,
  }: {
    activeTab: ProfileTab;
    profile: CustomerProfile;
    locale: string;
    t: (key: string, params?: Record<string, string | number>) => string;
    projectsLoading: boolean;
    projectsError: string | null;
    estimatesLoading: boolean;
    estimatesError: string | null;
    invoicesLoading: boolean;
    invoicesError: string | null;
    timelineItems: OrionTimelineItem[];
    timelineLoading: boolean;
    timelineError: string | null;
  }) {
    switch (activeTab) {
      case "projects":
        return <ProjectsTab profile={profile} locale={locale} t={t} projectsLoading={projectsLoading} projectsError={projectsError} />;
      case "estimates":
        return <EstimatesTab profile={profile} locale={locale} t={t} estimatesLoading={estimatesLoading} estimatesError={estimatesError} />;
      case "invoices":
        return <InvoicesTab profile={profile} locale={locale} t={t} invoicesLoading={invoicesLoading} invoicesError={invoicesError} />;
      case "change-orders":
        return <ChangeOrdersTab profile={profile} />;
      case "documents":
        return <DocumentsTab timelineItems={timelineItems} timelineLoading={timelineLoading} timelineError={timelineError} locale={locale} t={t} />;
      case "photos":
        return <PhotosTab profile={profile} locale={locale} t={t} />;
      case "notes":
        return <NotesTab profile={profile} />;
      case "timeline":
        return <TimelineTab locale={locale} t={t} timelineItems={timelineItems} timelineLoading={timelineLoading} timelineError={timelineError} />;
      case "overview":
      default:
        return <OverviewTab profile={profile} locale={locale} t={t} timelineItems={timelineItems} timelineLoading={timelineLoading} timelineError={timelineError} />;
    }
  }

  function OverviewTab({ profile, locale, t, timelineItems, timelineLoading, timelineError }: { profile: CustomerProfile; locale: string; t: (key: string, params?: Record<string, string | number>) => string; timelineItems: OrionTimelineItem[]; timelineLoading: boolean; timelineError: string | null; }) {
    return (
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-4">
          <ProfileCard title="Customer Information" icon={<UserRound size={16} />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailRow label="Primary Contact" value={profile.primaryContactName} />
              <DetailRow label="Account Owner" value={profile.accountOwnerName} subValue={profile.accountOwnerRole} />
              <DetailRow label="Phone" value={profile.contactPhone || t("customers.notProvided")} />
              <DetailRow label="Email" value={profile.contactEmail || t("customers.notProvided")} />
              <DetailRow label="Address" value={profile.address || t("customers.notProvided")} multiline />
              <DetailRow label="Customer Since" value={profile.customerSince} />
            </div>
          </ProfileCard>

          <ProfileCard title="Financial Summary" icon={<CreditCard size={16} />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryCard icon={<CreditCard size={16} aria-hidden="true" />} label="Outstanding Balance" value={formatProjectCurrency(profile.outstandingBalance, localeTag(locale), "$0")} context={profile.outstandingBalance > 0 ? "Balance due" : "No outstanding balance"} tone="warning" compact />
              <SummaryCard icon={<ReceiptText size={16} aria-hidden="true" />} label="Invoices" value={String(profile.invoices.length)} context="Billing records" tone="info" compact />
              <SummaryCard icon={<ReceiptText size={16} aria-hidden="true" />} label="Estimates" value={String(profile.estimates.length)} context="Estimate records" tone="brand" compact />
              <SummaryCard icon={<Building2 size={16} aria-hidden="true" />} label="Active Projects" value={String(profile.activeProjects.length)} context="Projects in progress" tone="success" compact />
            </div>
          </ProfileCard>

          <ProfileCard title="Recent Activity Timeline" icon={<History size={16} />}>
            <TimelineList compact locale={locale} t={t} timelineItems={timelineItems} timelineLoading={timelineLoading} timelineError={timelineError} />
          </ProfileCard>
        </div>

        <ProfileCard title="AI Insights" icon={<Globe size={16} />}>
          <AIInsightsCard profile={profile} />
        </ProfileCard>
      </section>
    );
  }

  function ChangeOrdersTab({ profile }: { profile: CustomerProfile; }) {
    return (
      <TabCard title="Change Orders" description="Change orders associated with this customer.">
        {profile.changeOrders.length > 0 ? (
          <div className="space-y-3">
            {profile.changeOrders.map((changeOrder) => (
              <article key={changeOrder.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 transition-all duration-200 hover:-translate-y-px hover:shadow-[var(--shadow-card)]">
                <div className="flex items-center justify-between gap-3">
                  <Link href={`/change-orders/${changeOrder.id}`} className="text-sm font-semibold text-[var(--color-brand-700)] transition hover:text-[var(--color-brand-800)]">
                    {changeOrder.change_order_number || "Unassigned"}
                  </Link>
                  <Badge tone={statusToneForChangeOrder(changeOrder.status)}>{toTitleCase(changeOrder.status.replace(/_/g, " "))}</Badge>
                </div>
                <p className="mt-1 text-sm text-[var(--color-text-primary)]">{changeOrder.title}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                  <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 font-semibold ring-1 ring-inset ring-[var(--color-border-subtle)]">${formatProjectCurrency(changeOrder.total_amount, localeTag("en-US"), "$0")}</span>
                  <span>Related Project</span>
                  <Link href={`/projects/${changeOrder.project_id}`} className="font-semibold text-[var(--color-brand-700)] transition hover:text-[var(--color-brand-800)]">
                    {changeOrder.project_id || "Not provided"}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState compact title="No change orders yet" description="No change orders are linked to this customer yet." />
        )}
      </TabCard>
    );
  }

  function ProjectsTab({ profile, locale, t, projectsLoading, projectsError }: { profile: CustomerProfile; locale: string; t: (key: string, params?: Record<string, string | number>) => string; projectsLoading: boolean; projectsError: string | null; }) {
    return (
      <TabCard title="Projects" description="Active and historical projects associated with this customer.">
        {projectsLoading ? (
          <TableLoadingState rows={4} columns={7} />
        ) : projectsError ? (
          <ErrorState title={t("customers.errorCustomerTitle")} description={projectsError} compact />
        ) : profile.activeProjects.length > 0 ? (
          <EnterpriseTable ariaLabel="Customer projects" minWidthClassName="min-w-[1200px]">
            <EnterpriseTableHead>
              <tr>
                <EnterpriseTableHeading>Project Name</EnterpriseTableHeading>
                <EnterpriseTableHeading>Project #</EnterpriseTableHeading>
                <EnterpriseTableHeading>Status</EnterpriseTableHeading>
                <EnterpriseTableHeading>Location</EnterpriseTableHeading>
                <EnterpriseTableHeading>Start Date</EnterpriseTableHeading>
                <EnterpriseTableHeading>Contract Value</EnterpriseTableHeading>
                <EnterpriseTableHeading align="right">Actions</EnterpriseTableHeading>
              </tr>
            </EnterpriseTableHead>
            <EnterpriseTableBody>
              {profile.activeProjects.map((project) => (
                <EnterpriseTableRow key={project.id}>
                  <EnterpriseTableCell>
                    <div>
                      <p className="font-semibold text-[var(--color-text-primary)]">{project.name}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{project.project_number || t("customers.notProvided")}</p>
                    </div>
                  </EnterpriseTableCell>
                  <EnterpriseTableCell>{project.project_number || t("customers.notProvided")}</EnterpriseTableCell>
                  <EnterpriseTableCell>
                    <ProjectStatusBadge statusKey={project.status} label={normalizeProjectStatus(project.status).label} />
                  </EnterpriseTableCell>
                  <EnterpriseTableCell>{formatProjectLocation(project) || t("customers.notProvided")}</EnterpriseTableCell>
                  <EnterpriseTableCell>{formatProjectDate(project.estimated_start_date, localeTag(locale), t("customers.notProvided"))}</EnterpriseTableCell>
                  <EnterpriseTableCell>{formatProjectCurrency(project.contract_amount ?? project.estimated_cost, localeTag(locale), t("customers.notProvided"))}</EnterpriseTableCell>
                  <EnterpriseTableCell align="right">
                    <Link href={`/projects/${project.id}`} className="font-semibold text-[var(--color-brand-700)] hover:text-[var(--color-brand-800)]">
                      View
                    </Link>
                  </EnterpriseTableCell>
                </EnterpriseTableRow>
              ))}
            </EnterpriseTableBody>
          </EnterpriseTable>
        ) : (
          <EmptyState compact title="No projects yet" description="No projects are linked to this customer yet." />
        )}
      </TabCard>
    );
  }

  function DocumentsTab({ timelineItems, timelineLoading, timelineError, locale, t }: { timelineItems: OrionTimelineItem[]; timelineLoading: boolean; timelineError: string | null; locale: string; t: (key: string, params?: Record<string, string | number>) => string; }) {
    const documentEvents = timelineItems
      .filter((item) => item.eventType.startsWith("document."))
      .slice(0, 10);
    const communicationEvents = timelineItems
      .filter((item) => item.eventType.startsWith("customer_update.") || item.eventType === "customer_message.received")
      .slice(0, 10);

    return (
      <TabCard title="Documents" description="Documents linked to this customer.">
        {timelineLoading ? <TableLoadingState rows={2} columns={1} /> : null}

        {timelineError ? (
          <ErrorState compact title={t("customers.errorCustomerTitle")} description={timelineError} />
        ) : null}

        {documentEvents.length > 0 ? (
          <div className="space-y-3">
            {documentEvents.map((item) => (
              <article key={item.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{formatTimelineText(item, t).title}</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{formatTimelineText(item, t).summary}</p>
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">{formatTimelineOccurredAt(item.occurredAt, localeTag(locale))}</p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState compact title="No customer document events yet" description="No document upload or delete events have been recorded for this customer." />
        )}

        {communicationEvents.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Communications</p>
            {communicationEvents.map((item) => (
              <article key={item.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-4">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{formatTimelineText(item, t).title}</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{formatTimelineText(item, t).summary}</p>
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">{formatTimelineOccurredAt(item.occurredAt, localeTag(locale))}</p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState compact title="No communications recorded yet" description="No customer communication events have been recorded yet." />
        )}
      </TabCard>
    );
  }

  function PhotosTab({ profile, locale, t }: { profile: CustomerProfile; locale: string; t: (key: string, params?: Record<string, string | number>) => string; }) {
    const photos = profile.photos.slice(0, 24);

    return (
      <TabCard title="Photos" description="Site photos and image attachments for this customer.">
        {photos.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo) => (
              <article key={photo.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{photo.original_filename || `Photo ${photo.id.slice(0, 8)}`}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{photo.category || "general"}</p>
                  </div>
                  <Camera size={16} aria-hidden="true" className="shrink-0 text-[var(--color-text-muted)]" />
                </div>
                <p className="mt-3 text-xs text-[var(--color-text-secondary)]">Captured {formatProjectDate(photo.captured_at, localeTag(locale), t("customers.notProvided"))}</p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Project <Link href={`/projects/${photo.project_id}`} className="font-semibold text-[var(--color-brand-700)] hover:text-[var(--color-brand-800)]">{photo.project_id.slice(0, 8)}</Link></p>
                {photo.note ? <p className="mt-2 text-xs text-[var(--color-text-secondary)] line-clamp-2">{photo.note}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState compact title="No photos recorded yet" description="No customer-related project photos have been uploaded yet." />
        )}
      </TabCard>
    );
  }

  function TimelineTab({ locale, t, timelineItems, timelineLoading, timelineError }: { locale: string; t: (key: string, params?: Record<string, string | number>) => string; timelineItems: OrionTimelineItem[]; timelineLoading: boolean; timelineError: string | null; }) {
    return (
      <TabCard title="Timeline" description="A chronological view of customer activity.">
        <TimelineList locale={locale} t={t} timelineItems={timelineItems} timelineLoading={timelineLoading} timelineError={timelineError} />
        <div className="space-y-4">
          <article className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm leading-7 text-[var(--color-text-secondary)] shadow-[var(--shadow-small)]">
            Timeline events are sourced from Orion and scoped to this customer.
          </article>
        </div>
      </TabCard>
    );
  }

  function EstimatesTab({ profile, locale, t, estimatesLoading, estimatesError }: { profile: CustomerProfile; locale: string; t: (key: string, params?: Record<string, string | number>) => string; estimatesLoading: boolean; estimatesError: string | null; }) {
    return (
      <TabCard title="Estimates" description="Estimates associated with this customer.">
        {estimatesLoading ? (
          <TableLoadingState rows={3} columns={6} />
        ) : estimatesError ? (
          <ErrorState title={t("customers.errorCustomerTitle")} description={estimatesError} compact />
        ) : profile.estimates.length > 0 ? (
          <EnterpriseTable ariaLabel="Customer estimates" minWidthClassName="min-w-[1040px]">
            <EnterpriseTableHead>
              <tr>
                <EnterpriseTableHeading>Estimate #</EnterpriseTableHeading>
                <EnterpriseTableHeading>Name</EnterpriseTableHeading>
                <EnterpriseTableHeading>Project</EnterpriseTableHeading>
                <EnterpriseTableHeading>Status</EnterpriseTableHeading>
                <EnterpriseTableHeading>Date</EnterpriseTableHeading>
                <EnterpriseTableHeading>Total</EnterpriseTableHeading>
                <EnterpriseTableHeading align="right">Actions</EnterpriseTableHeading>
              </tr>
            </EnterpriseTableHead>
            <EnterpriseTableBody>
              {profile.estimates.map((estimate) => (
                <EnterpriseTableRow key={estimate.id}>
                  <EnterpriseTableCell>{estimate.estimate_number || t("customers.notProvided")}</EnterpriseTableCell>
                  <EnterpriseTableCell>{estimate.title}</EnterpriseTableCell>
                  <EnterpriseTableCell>{estimate.project_id || t("customers.notProvided")}</EnterpriseTableCell>
                  <EnterpriseTableCell><EstimateStatusBadge label={toTitleCase(estimate.status.replace(/_/g, " "))} status={estimate.status} /></EnterpriseTableCell>
                  <EnterpriseTableCell>{formatProjectDate(estimate.issue_date, localeTag(locale), t("customers.notProvided"))}</EnterpriseTableCell>
                  <EnterpriseTableCell>{formatProjectCurrency(estimate.total_amount, localeTag(locale), t("customers.notProvided"))}</EnterpriseTableCell>
                  <EnterpriseTableCell align="right"><Link href={`/estimates/${estimate.id}`} className="font-semibold text-[var(--color-brand-700)] hover:text-[var(--color-brand-800)]">View</Link></EnterpriseTableCell>
                </EnterpriseTableRow>
              ))}
            </EnterpriseTableBody>
          </EnterpriseTable>
        ) : (
          <EmptyState compact title="No estimates yet" description="No estimates are linked to this customer yet." />
        )}
      </TabCard>
    );
  }

  function InvoicesTab({ profile, locale, t, invoicesLoading, invoicesError }: { profile: CustomerProfile; locale: string; t: (key: string, params?: Record<string, string | number>) => string; invoicesLoading: boolean; invoicesError: string | null; }) {
    const newInvoiceHref = `/invoices/new?customerId=${profile.customer.id}${profile.currentProject ? `&projectId=${profile.currentProject.id}` : ""}`;

    return (
      <TabCard title="Invoices" description="Invoices associated with this customer.">
        <div className="flex justify-end">
          <Link href={newInvoiceHref} className="inline-flex h-9 items-center rounded-[var(--radius-md)] bg-[var(--color-brand-600)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-700)]">
            New Invoice
          </Link>
        </div>

        {invoicesLoading ? (
          <TableLoadingState rows={3} columns={7} />
        ) : invoicesError ? (
          <ErrorState title={t("customers.errorCustomerTitle")} description={invoicesError} compact />
        ) : profile.invoices.length > 0 ? (
          <EnterpriseTable ariaLabel="Customer invoices" minWidthClassName="min-w-[1160px]">
            <EnterpriseTableHead>
              <tr>
                <EnterpriseTableHeading>Invoice #</EnterpriseTableHeading>
                <EnterpriseTableHeading>Title</EnterpriseTableHeading>
                <EnterpriseTableHeading>Project</EnterpriseTableHeading>
                <EnterpriseTableHeading>Status</EnterpriseTableHeading>
                <EnterpriseTableHeading>Issue Date</EnterpriseTableHeading>
                <EnterpriseTableHeading>Due Date</EnterpriseTableHeading>
                <EnterpriseTableHeading>Total</EnterpriseTableHeading>
                <EnterpriseTableHeading>Balance</EnterpriseTableHeading>
                <EnterpriseTableHeading align="right">Actions</EnterpriseTableHeading>
              </tr>
            </EnterpriseTableHead>
            <EnterpriseTableBody>
              {profile.invoices.map((invoice) => {
                const balance = Math.max(invoice.total_amount - invoice.amount_paid, 0);

                return (
                  <EnterpriseTableRow key={invoice.id}>
                    <EnterpriseTableCell>{invoice.invoice_number || t("customers.notProvided")}</EnterpriseTableCell>
                    <EnterpriseTableCell>{invoice.title}</EnterpriseTableCell>
                    <EnterpriseTableCell>{invoice.project_id || t("customers.notProvided")}</EnterpriseTableCell>
                    <EnterpriseTableCell><InvoiceStatusBadge status={invoice.status} /></EnterpriseTableCell>
                    <EnterpriseTableCell>{formatProjectDate(invoice.issue_date, localeTag(locale), t("customers.notProvided"))}</EnterpriseTableCell>
                    <EnterpriseTableCell>{formatProjectDate(invoice.due_date, localeTag(locale), t("customers.notProvided"))}</EnterpriseTableCell>
                    <EnterpriseTableCell>{formatProjectCurrency(invoice.total_amount, localeTag(locale), t("customers.notProvided"))}</EnterpriseTableCell>
                    <EnterpriseTableCell>{formatProjectCurrency(balance, localeTag(locale), t("customers.notProvided"))}</EnterpriseTableCell>
                    <EnterpriseTableCell align="right"><Link href={`/invoices/${invoice.id}`} className="font-semibold text-[var(--color-brand-700)] hover:text-[var(--color-brand-800)]">View</Link></EnterpriseTableCell>
                  </EnterpriseTableRow>
                );
              })}
            </EnterpriseTableBody>
          </EnterpriseTable>
        ) : (
          <EmptyState compact title="No invoices yet" description="No invoices are linked to this customer yet." />
        )}
      </TabCard>
    );
  }

  function NotesTab({ profile }: { profile: CustomerProfile; }) {
    return (
      <TabCard title="Notes" description="Customer notes captured in the record.">
        {profile.notes ? (
          <article className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-50)] text-[var(--color-brand-700)]">
                <StickyNote size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-semibold text-[var(--color-text-primary)]">Customer Note</p>
                  <p className="text-xs font-medium text-[var(--color-text-secondary)]">Updated {formatDate(profile.customer.updated_at)}</p>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[var(--color-text-secondary)]">{profile.notes}</p>
              </div>
            </div>
          </article>
        ) : (
          <EmptyState compact icon={<StickyNote size={18} />} title="No notes yet" description="This customer does not have notes on file yet." />
        )}
      </TabCard>
    );
  }

  function AIInsightsCard({ profile }: { profile: CustomerProfile; }) {
    const insights = [
      profile.outstandingBalance > 0
        ? `Outstanding balance is ${formatProjectCurrency(profile.outstandingBalance, "$", "$0")}.`
        : "No outstanding balance detected.",
      profile.activeProjects.length > 0
        ? `${profile.activeProjects.length} active project${profile.activeProjects.length === 1 ? "" : "s"} are currently linked.`
        : "There are no active projects linked right now.",
      profile.estimates.length > 0
        ? `${profile.approvedEstimateCount} approved estimate${profile.approvedEstimateCount === 1 ? "" : "s"} can support follow-up.`
        : "No estimates are available yet.",
    ];

    return (
      <div className="space-y-3">
        {insights.map((insight, index) => (
          <article key={index} className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 transition-all duration-200 hover:-translate-y-px hover:shadow-[var(--shadow-card)]">
            <p className="text-sm leading-6 text-[var(--color-text-primary)]">{insight}</p>
          </article>
        ))}
      </div>
    );
  }

  function TimelineList({ compact = false, locale, t, timelineItems, timelineLoading, timelineError }: { compact?: boolean; locale: string; t: (key: string, params?: Record<string, string | number>) => string; timelineItems: OrionTimelineItem[]; timelineLoading: boolean; timelineError: string | null; }) {
    const items = timelineItems.slice(0, compact ? 4 : 12);

    if (timelineLoading) {
      return <TableLoadingState rows={compact ? 2 : 4} columns={1} />;
    }

    if (timelineError) {
      return <ErrorState compact title={t("customers.errorCustomerTitle")} description={timelineError} />;
    }

    if (items.length === 0) {
      return <EmptyState compact title="No activity recorded yet" description="Orion has not recorded customer activity for this workspace yet." />;
    }

    return (
      <div className="relative space-y-4 pl-2">
        <span aria-hidden="true" className="pointer-events-none absolute bottom-2 left-5 top-2 hidden w-px bg-[var(--color-border-subtle)] sm:block" />
        {items.map((item) => (
          <article key={item.id} className="relative rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 transition-all duration-200 hover:-translate-y-px hover:shadow-[var(--shadow-card)] sm:pl-14">
            <span aria-hidden="true" className="absolute left-0 top-4 hidden h-10 w-10 items-center justify-center rounded-full bg-[var(--color-brand-600)]/10 text-[var(--color-brand-700)] shadow-[0_10px_18px_-14px_rgb(15_23_42/0.45)] sm:flex">
              <History size={16} />
            </span>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{formatTimelineText(item, t).title}</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{formatTimelineText(item, t).summary}</p>
              </div>
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">{formatTimelineOccurredAt(item.occurredAt, localeTag(locale))}</p>
            </div>
          </article>
        ))}
      </div>
    );
  }

  function CustomerLoadingState() {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonLoader className="h-10 w-80" />
          <div className="flex justify-end gap-2">
            <SkeletonLoader className="h-11 w-32" />
            <SkeletonLoader className="h-11 w-11" />
          </div>
        </div>

        <div className="rounded-[var(--radius-3xl)] bg-[var(--color-sidebar)] p-6">
          <div className="grid gap-6 xl:grid-cols-3">
            <SkeletonLoader className="h-44 w-full rounded-[var(--radius-2xl)]" />
            <SkeletonLoader className="h-44 w-full rounded-[var(--radius-2xl)]" />
            <SkeletonLoader className="h-44 w-full rounded-[var(--radius-2xl)]" />
          </div>
        </div>

        <SkeletonLoader className="h-14 w-full rounded-[var(--radius-2xl)]" />
        <div className="grid gap-4 xl:grid-cols-3">
          <SkeletonLoader className="h-52 w-full rounded-[var(--radius-2xl)]" />
          <SkeletonLoader className="h-52 w-full rounded-[var(--radius-2xl)]" />
          <SkeletonLoader className="h-52 w-full rounded-[var(--radius-2xl)]" />
        </div>
      </div>
    );
  }

  function CustomerErrorState({ message }: { message: string }) {
    const { t } = useI18n();

    return <ErrorState title={t("customers.errorCustomerTitle")} description={message} />;
  }

  function CustomerNotFoundState() {
    const { t } = useI18n();

    return (
      <EmptyState
        icon="?"
        title={t("customers.customerNotFoundTitle")}
        description={t("customers.customerNotFoundDescription")}
        action={
          <Link href="/customers" className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--color-brand-600)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-700)]">
            {t("customers.backToCustomers")}
          </Link>
        }
      />
    );
  }

  function TabCard({ title, description, children }: { title: string; description: string; children: ReactNode; }) {
    return (
      <Card variant="elevated">
        <CardHeader className="space-y-1.5">
          <CardTitle className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--color-text-primary)]">{title}</CardTitle>
          <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    );
  }

  function ProfileCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode; }) {
    return (
      <Card variant="elevated" className="xl:col-span-1">
        <CardHeader className="space-y-0">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-50)] text-[var(--color-brand-700)] shadow-[0_10px_18px_-14px_rgb(15_23_42/0.26)]">
              {icon}
            </span>
            <CardTitle className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--color-text-primary)]">{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">{children}</CardContent>
      </Card>
    );
  }

  function DetailRow({ label, value, subValue, multiline = false }: { label: string; value: string; subValue?: string; multiline?: boolean; }) {
    return (
      <div>
        <p className="text-sm font-medium tracking-[-0.01em] text-[var(--color-text-secondary)]">{label}</p>
        <p className={`mt-1 text-sm font-medium text-[var(--color-text-primary)] ${multiline ? "whitespace-pre-line leading-6" : ""}`}>{value}</p>
        {subValue ? <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{subValue}</p> : null}
      </div>
    );
  }

  function TableLoadingState({ rows, columns }: { rows: number; columns: number; }) {
    return (
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }).map((__, columnIndex) => (
              <SkeletonLoader key={columnIndex} className="h-10 w-full" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  function getCustomerName(row: CustomerRow) {
    const firstName = row.first_name?.trim() || "";
    const lastName = row.last_name?.trim() || "";
    const companyName = row.company_name?.trim() || "";
    const residentialName = [firstName, lastName].filter(Boolean).join(" ");

    if (getCustomerTypeKey(row.customer_type) === "commercial") {
      return companyName || residentialName || "Unnamed Customer";
    }

    return residentialName || companyName || "Unnamed Customer";
  }

  function getCustomerTypeKey(customerType: string | null): "residential" | "commercial" {
    return customerType?.trim().toLowerCase() === "commercial" ? "commercial" : "residential";
  }

  function getCustomerStatusKey(status: string | null) {
    return status?.trim().toLowerCase() || "inactive";
  }

  function getCustomerStatusLabel(statusKey: string, t: (key: string) => string) {
    const map: Record<string, string> = {
      active: t("customers.statusActive"),
      lead: t("customers.statusLead"),
      inactive: t("customers.statusInactive"),
      archived: t("customers.statusArchived"),
      on_hold: "On Hold",
      preferred: "Preferred",
      pending: t("customers.statusPending"),
    };

    return map[statusKey] || toTitleCase(statusKey.replace(/_/g, " "));
  }

  function getDisplayName(firstName: string | null, lastName: string | null, fallback: string) {
    const name = [firstName?.trim() || "", lastName?.trim() || ""].filter(Boolean).join(" ");
    return name || fallback;
  }

  function getDisplayNameFromRole(role: string | null | undefined) {
    if (!role || !role.trim()) {
      return "Account Owner";
    }

    return toTitleCase(role.trim().replace(/_/g, " "));
  }

  function formatCustomerAddress(row: CustomerRow) {
    const parts = [
      row.address_line_1?.trim() || "",
      row.address_line_2?.trim() || "",
      [row.city?.trim() || "", row.state?.trim() || "", row.postal_code?.trim() || ""].filter(Boolean).join(" "),
    ].filter(Boolean);

    return parts.join("\n");
  }

  function isActiveProjectStatus(status: string) {
    return ["approved", "scheduled", "in_progress", "on_hold", "estimating", "lead"].includes(status);
  }

  function buildCustomerTags({
    customerTypeLabel,
    statusLabel,
    activeProjects,
    notes,
  }: {
    customerTypeLabel: string;
    statusLabel: string;
    activeProjects: RelatedProject[];
    notes: string;
  }) {
    const tags = [customerTypeLabel, statusLabel];

    if (activeProjects.length > 1) {
      tags.push("Repeat Customer");
    }

    if (notes.trim()) {
      tags.push("Has Notes");
    }

    return tags;
  }

  function formatCustomerTypeLabel(label: string) {
    return label.replace(/\s+Customer$/i, "").replace(/\s+/g, " ").trim();
  }

  function statusToneForChangeOrder(status: string): "neutral" | "brand" | "info" | "success" | "warning" | "danger" | "error" | "analytics" {
    const normalized = status.trim().toLowerCase();

    if (normalized.includes("approved") || normalized.includes("accepted") || normalized.includes("closed")) {
      return "success";
    }

    if (normalized.includes("pending") || normalized.includes("submitted") || normalized.includes("review")) {
      return "warning";
    }

    if (normalized.includes("draft") || normalized.includes("new")) {
      return "neutral";
    }

    return "brand";
  }

  function resolveWorkspaceError(errorCode: string | null, fallback: string | null, t: (key: string) => string) {
    if (errorCode === "unauthenticated") {
      return t("customers.errorViewCustomerLogin");
    }

    if (errorCode === "profile_missing") {
      return t("customers.errorProfileMissing");
    }

    if (errorCode === "company_missing") {
      return t("customers.errorNoCompanyYet");
    }

    if (errorCode === "supabase_unavailable") {
      return t("customers.errorConnect");
    }

    return fallback || t("customers.errorLoadCustomerUnexpected");
  }

  function localeTag(locale: string) {
    return locale === "es" ? "es-ES" : "en-US";
  }

  function formatDate(value: string, locale = "en-US", fallbackLabel = "Not provided") {
    if (!value) {
      return fallbackLabel;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return fallbackLabel;
    }

    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  }

  function formatProjectLocation(project: RelatedProject) {
    const parts = [
      project.address_line_1?.trim() || "",
      project.address_line_2?.trim() || "",
      [project.city?.trim() || "", project.state?.trim() || "", project.postal_code?.trim() || ""]
        .filter(Boolean)
        .join(" "),
    ].filter(Boolean);

    return parts.join(", ");
  }

  function toTitleCase(value: string) {
    return value
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
