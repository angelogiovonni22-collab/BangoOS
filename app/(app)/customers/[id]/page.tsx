  "use client";

  import Link from "next/link";
  import { useParams } from "next/navigation";
  import { type ReactNode, useEffect, useMemo, useState } from "react";
  import {
    Building2,
    CalendarDays,
    Clock3,
    CreditCard,
    EllipsisVertical,
    Globe,
    History,
    Mail,
    MapPin,
    Phone,
    ReceiptText,
    StickyNote,
    UserRound,
    Users,
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
  import { getEstimateStatusBadgeClass } from "@/lib/estimates/statuses";
  import { getProjectStatusBadgeClass } from "@/lib/projects/statuses";
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
    outstandingBalance: number;
    approvedEstimateCount: number;
    tags: string[];
  };

  type ProfileTab = "overview" | "contacts" | "projects" | "estimates" | "invoices" | "activity" | "notes";
  type HeroTone = "blue" | "green" | "orange" | "purple" | "red" | "cyan";

  const PROFILE_TABS: Array<{ key: ProfileTab; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "contacts", label: "Contacts" },
    { key: "projects", label: "Projects" },
    { key: "estimates", label: "Estimates" },
    { key: "invoices", label: "Invoices" },
    { key: "activity", label: "Activity" },
    { key: "notes", label: "Notes" },
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
              outstandingBalance,
              approvedEstimateCount,
              tags: buildCustomerTags({ customerTypeLabel, statusLabel, activeProjects, notes }),
            });

            setProjectsLoading(false);
            setEstimatesLoading(false);
            setInvoicesLoading(false);
            setIsLoading(false);
          }
        } catch (caughtError) {
          console.error("Load customer error:", caughtError);

          if (isSubscribed) {
            setErrorMessage(t("customers.errorLoadCustomerUnexpected"));
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
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
              <Link href="/customers" className="text-[var(--color-brand-700)] transition hover:text-[var(--color-brand-800)]">
                Customers
              </Link>
              <span>/</span>
              <span className="truncate">{customerProfile.customerName}</span>
            </div>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-[2.35rem]">Customer Profile</h1>
          </div>

          <div className="flex items-center gap-2 self-start">
            <Link
              href={`/customers/${customerProfile.customer.id}/edit`}
              className="inline-flex h-11 items-center rounded-[var(--radius-lg)] bg-[var(--color-brand-600)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-700)]"
            >
              Edit Customer
            </Link>

            <details className="relative">
              <summary className="flex h-11 w-11 list-none items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] text-[var(--color-text-secondary)] shadow-[var(--shadow-small)] transition hover:bg-[var(--color-surface-subtle)]">
                <EllipsisVertical size={18} aria-hidden="true" />
              </summary>

              <div className="absolute right-0 z-20 mt-2 w-56 rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-2 shadow-[0_18px_30px_-18px_rgb(15_23_42/0.35)]">
                <ActionMenuItem label="Archive Customer" disabled />
                <ActionMenuItem label="Delete Customer" disabled destructive />
              </div>
            </details>
          </div>
        </div>

        <CustomerHero profile={customerProfile} locale={locale} />

        <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-1.5 shadow-[var(--shadow-small)]">
          <nav className="flex gap-1.5 overflow-x-auto" aria-label="Customer profile tabs">
            {PROFILE_TABS.map((tab) => {
              const active = tab.key === activeTab;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`whitespace-nowrap rounded-[var(--radius-lg)] border-b-2 px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)] ${
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

        <div role="tabpanel" aria-label={PROFILE_TABS.find((tab) => tab.key === activeTab)?.label || "Customer profile section"}>
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
  }) {
    switch (activeTab) {
      case "contacts":
        return <ContactsTab profile={profile} t={t} />;
      case "projects":
        return <ProjectsTab profile={profile} locale={locale} t={t} projectsLoading={projectsLoading} projectsError={projectsError} />;
      case "estimates":
        return <EstimatesTab profile={profile} locale={locale} t={t} estimatesLoading={estimatesLoading} estimatesError={estimatesError} />;
      case "invoices":
        return <InvoicesTab profile={profile} locale={locale} t={t} invoicesLoading={invoicesLoading} invoicesError={invoicesError} />;
      case "activity":
        return <ActivityTab profile={profile} />;
      case "notes":
        return <NotesTab profile={profile} />;
      case "overview":
      default:
        return <OverviewTab profile={profile} locale={locale} t={t} />;
    }
  }

  function CustomerHero({ profile, locale }: { profile: CustomerProfile; locale: string; }) {
    return (
      <section className="rounded-[var(--radius-3xl)] bg-[var(--color-sidebar)] px-6 py-6 text-white shadow-[0_24px_44px_-30px_rgb(15_23_42/0.7)] sm:px-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,0.95fr)] xl:items-start">
          <div className="space-y-4">
            <div className="flex items-center gap-5">
              <CustomerAvatar name={profile.customerName} className="h-[72px] w-[72px] shrink-0 border border-white/10 bg-white/10 text-lg font-semibold text-white" />

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">Customer Account</p>
                <h2 className="mt-2 truncate text-[2.15rem] font-extrabold tracking-[-0.04em] text-white sm:text-[2.9rem]">{profile.customerName}</h2>
                <p className="mt-2 text-sm font-semibold text-white/75">{profile.customerTypeLabel}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <HeroBadge>{profile.statusLabel}</HeroBadge>
                  <HeroBadge tone="muted">Primary Contact</HeroBadge>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <HeroMetric
                label="Active Projects"
                value={String(profile.activeProjects.length)}
                supportingText={profile.activeProjects.length > 0 ? "Projects currently in progress" : "No active projects"}
                tone="blue"
                icon={<Building2 size={18} aria-hidden="true" />}
              />
              <HeroMetric
                label="Open Estimates"
                value={String(profile.estimates.length)}
                supportingText={profile.estimates.length > 0 ? "Estimates awaiting action" : "No open estimates"}
                tone="green"
                icon={<ReceiptText size={18} aria-hidden="true" />}
              />
            </div>

            <div className="rounded-[var(--radius-2xl)] border border-white/10 bg-white/[0.07] px-4 py-4 shadow-[0_12px_24px_-22px_rgb(15_23_42/0.55)]">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/55">Current Project</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {profile.currentProject ? profile.currentProject.name : "No active project yet"}
              </p>
              <p className="mt-1 text-xs font-medium text-white/60">
                {profile.currentProject ? "Most recent active work" : "No active projects"}
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            <HeroInfoLine icon={<Phone size={18} />} label="Phone" value={profile.contactPhone || "Not provided"} tone="blue" />
            <HeroInfoLine icon={<Mail size={18} />} label="Email" value={profile.contactEmail || "Not provided"} tone="green" />
            <HeroInfoLine icon={<CalendarDays size={18} />} label="Customer Since" value={profile.customerSince} tone="orange" />
            <HeroInfoLine icon={<UserRound size={18} />} label="Account Owner" value={profile.accountOwnerName} subValue={profile.accountOwnerRole} tone="purple" />
          </div>

          <div className="grid gap-3">
            <HeroInfoLine icon={<MapPin size={18} />} label="Primary Address" value={profile.address || "Not provided"} multiline tone="red" />
            <HeroInfoLine icon={<Building2 size={18} />} label="Primary Contact" value={profile.primaryContactName} subValue={profile.customerTypeLabel} tone="cyan" />
            <HeroInfoLine
              icon={<CreditCard size={18} />}
              label="Outstanding Balance"
              value={formatProjectCurrency(profile.outstandingBalance, localeTag(locale), "$0")}
              subValue={profile.outstandingBalance > 0 ? "Balance currently outstanding" : "No outstanding balance"}
              tone="orange"
            />
            <HeroInfoLine icon={<Globe size={18} />} label="Website" value="Not provided" tone="blue" />
          </div>
        </div>
      </section>
    );
  }

  function OverviewTab({ profile, locale, t }: { profile: CustomerProfile; locale: string; t: (key: string, params?: Record<string, string | number>) => string; }) {
    const customerSummary = [
      {
        label: "Total Projects",
        value: profile.activeProjects.length + (profile.currentProject && !profile.activeProjects.includes(profile.currentProject) ? 1 : 0),
        context: "Linked projects",
        tone: "brand" as const,
        icon: <Building2 size={18} aria-hidden="true" />,
      },
      {
        label: "Active Projects",
        value: profile.activeProjects.length,
        context: profile.activeProjects.length > 0 ? "Projects in progress" : "No active projects",
        tone: "success" as const,
        icon: <Clock3 size={18} aria-hidden="true" />,
      },
      {
        label: "Estimates",
        value: profile.estimates.length,
        context: profile.estimates.length > 0 ? "Estimate records" : "No open estimates",
        tone: "info" as const,
        icon: <ReceiptText size={18} aria-hidden="true" />,
      },
      {
        label: "Approved Estimates",
        value: profile.approvedEstimateCount,
        context: profile.approvedEstimateCount > 0 ? "Ready for follow-up" : "No approved estimates",
        tone: "success" as const,
        icon: <Users size={18} aria-hidden="true" />,
      },
      {
        label: "Invoices",
        value: profile.invoices.length,
        context: profile.invoices.length > 0 ? "Billing records" : "No invoices yet",
        tone: "warning" as const,
        icon: <CreditCard size={18} aria-hidden="true" />,
      },
      {
        label: "Change Orders",
        value: profile.changeOrders.length,
        context: profile.changeOrders.length > 0 ? "Scope change records" : "No change orders",
        tone: "info" as const,
        icon: <ReceiptText size={18} aria-hidden="true" />,
      },
      {
        label: "Outstanding Balance",
        value: formatProjectCurrency(profile.outstandingBalance, localeTag(locale), "$0"),
        context: profile.outstandingBalance > 0 ? "Balance due" : "No outstanding balance",
        tone: "danger" as const,
        icon: <CreditCard size={18} aria-hidden="true" />,
      },
    ];

    return (
      <section className="grid gap-4 xl:grid-cols-3">
        <ProfileCard title="Contact Information" icon={<Phone size={16} />}>
          <DetailRow label="Phone" value={profile.contactPhone || t("customers.notProvided")} />
          <DetailRow label="Email" value={profile.contactEmail || t("customers.notProvided")} />
          <DetailRow label="Website" value={t("customers.notProvided")} />
          <DetailRow label="Address" value={profile.address || t("customers.notProvided")} multiline />
        </ProfileCard>

        <ProfileCard title="Primary Contact" icon={<Building2 size={16} />}>
          <DetailRow label="Contact Name" value={profile.primaryContactName} />
          <DetailRow label="Title" value="Primary Contact" />
          <DetailRow label="Phone" value={profile.contactPhone || t("customers.notProvided")} />
          <DetailRow label="Email" value={profile.contactEmail || t("customers.notProvided")} />
        </ProfileCard>

        <ProfileCard title="Customer Details" icon={<UserRound size={16} />}>
          <DetailRow label="Status" value={profile.statusLabel} />
          <DetailRow label="Type" value={formatCustomerTypeLabel(profile.customerTypeLabel)} />
          <DetailRow label="Customer Since" value={profile.customerSince} />
          <DetailRow label="Account Owner" value={profile.accountOwnerName} subValue={profile.accountOwnerRole} />
        </ProfileCard>

        <ProfileCard title="Billing Information" icon={<CreditCard size={16} />}>
          <DetailRow label="Billing Address" value={profile.address || t("customers.notProvided")} multiline />
          <DetailRow label="Billing Contact" value={profile.primaryContactName} />
          <DetailRow label="Billing Email" value={profile.contactEmail || t("customers.notProvided")} />
          <DetailRow label="Payment Terms" value={t("customers.notProvided")} />
        </ProfileCard>

        <ProfileCard title="Customer Summary" icon={<ReceiptText size={16} />}>
          <div className="grid gap-3 sm:grid-cols-2">
            {customerSummary.map((item) => (
              <SummaryCard key={item.label} icon={item.icon} label={item.label} value={String(item.value)} context={item.context} tone={item.tone} compact />
            ))}
          </div>
        </ProfileCard>

        <ProfileCard title="Tags & Attributes" icon={<StickyNote size={16} />}>
          {profile.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {profile.tags.map((tag) => (
                <Badge key={tag} tone={badgeToneForTag(tag)}>{tag}</Badge>
              ))}
            </div>
          ) : (
            <EmptyState compact icon={<StickyNote size={18} />} title="No Tags Yet" description="Customer tags and classifications will appear here when they are available." />
          )}
        </ProfileCard>

        <ProfileCard title="Recent Change Orders" icon={<ReceiptText size={16} />}>
          {profile.changeOrders.length > 0 ? (
            <div className="space-y-2">
              {profile.changeOrders.slice(0, 5).map((changeOrder) => (
                <article key={changeOrder.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <Link href={`/change-orders/${changeOrder.id}`} className="text-sm font-semibold text-[var(--color-brand-700)] hover:text-[var(--color-brand-800)]">
                      {changeOrder.change_order_number || "Unassigned"}
                    </Link>
                    <span className="text-xs text-[var(--color-text-secondary)]">{toTitleCase(changeOrder.status.replace(/_/g, " "))}</span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-text-primary)]">{changeOrder.title}</p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState compact title="No change orders yet" description="Change orders for this customer will appear here." />
          )}
        </ProfileCard>
      </section>
    );
  }

  function ContactsTab({ profile, t }: { profile: CustomerProfile; t: (key: string, params?: Record<string, string | number>) => string; }) {
    return (
      <Card variant="elevated">
        <CardHeader className="space-y-1.5">
          <CardTitle className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--color-text-primary)]">Contacts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-0">
          <EnterpriseTable ariaLabel="Customer contacts">
            <EnterpriseTableHead>
              <tr>
                <EnterpriseTableHeading>Name</EnterpriseTableHeading>
                <EnterpriseTableHeading>Role</EnterpriseTableHeading>
                <EnterpriseTableHeading>Phone</EnterpriseTableHeading>
                <EnterpriseTableHeading>Email</EnterpriseTableHeading>
                <EnterpriseTableHeading>Primary</EnterpriseTableHeading>
                <EnterpriseTableHeading align="right">Actions</EnterpriseTableHeading>
              </tr>
            </EnterpriseTableHead>
            <EnterpriseTableBody>
              <EnterpriseTableRow>
                <EnterpriseTableCell>
                  <div className="flex items-center gap-3">
                    <CustomerAvatar name={profile.primaryContactName} className="h-9 w-9 text-[11px]" />
                    <div>
                      <p className="font-semibold text-[var(--color-text-primary)]">{profile.primaryContactName}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{profile.customerTypeLabel}</p>
                    </div>
                  </div>
                </EnterpriseTableCell>
                <EnterpriseTableCell>{profile.accountOwnerRole}</EnterpriseTableCell>
                <EnterpriseTableCell>{profile.contactPhone || t("customers.notProvided")}</EnterpriseTableCell>
                <EnterpriseTableCell>{profile.contactEmail || t("customers.notProvided")}</EnterpriseTableCell>
                <EnterpriseTableCell><Badge tone="success">Primary</Badge></EnterpriseTableCell>
                <EnterpriseTableCell align="right">
                  <div className="inline-flex items-center gap-2">
                    <Link href={`/customers/${profile.customer.id}`} className="text-sm font-semibold text-[var(--color-brand-700)] hover:text-[var(--color-brand-800)]">View</Link>
                    <Link href={`/customers/${profile.customer.id}/edit`} className="text-sm font-semibold text-[var(--color-brand-700)] hover:text-[var(--color-brand-800)]">Edit</Link>
                  </div>
                </EnterpriseTableCell>
              </EnterpriseTableRow>
            </EnterpriseTableBody>
          </EnterpriseTable>
        </CardContent>
      </Card>
    );
  }

  function ProjectsTab({ profile, locale, t, projectsLoading, projectsError }: { profile: CustomerProfile; locale: string; t: (key: string, params?: Record<string, string | number>) => string; projectsLoading: boolean; projectsError: string | null; }) {
    return (
      <TabCard title="Projects" description="Projects associated with this customer.">
        {projectsLoading ? (
          <TableLoadingState rows={3} columns={6} />
        ) : projectsError ? (
          <ErrorState title={t("customers.errorProjectsTitle")} description={projectsError} compact />
        ) : profile.activeProjects.length > 0 ? (
          <EnterpriseTable ariaLabel="Customer projects" minWidthClassName="min-w-[1120px]">
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
                      <p className="text-xs text-[var(--color-text-secondary)]">{project.project_number || "Not provided"}</p>
                    </div>
                  </EnterpriseTableCell>
                  <EnterpriseTableCell>{project.project_number || t("customers.notProvided")}</EnterpriseTableCell>
                  <EnterpriseTableCell><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getProjectStatusBadgeClass(project.status)}`}>{normalizeProjectStatus(project.status).label}</span></EnterpriseTableCell>
                  <EnterpriseTableCell>{formatProjectLocation(project) || t("customers.notProvided")}</EnterpriseTableCell>
                  <EnterpriseTableCell>{formatProjectDate(project.estimated_start_date, localeTag(locale), t("customers.notProvided"))}</EnterpriseTableCell>
                  <EnterpriseTableCell>{formatProjectCurrency(project.contract_amount ?? project.estimated_cost, localeTag(locale), t("customers.notProvided"))}</EnterpriseTableCell>
                  <EnterpriseTableCell align="right"><Link href={`/projects/${project.id}`} className="font-semibold text-[var(--color-brand-700)] hover:text-[var(--color-brand-800)]">View</Link></EnterpriseTableCell>
                </EnterpriseTableRow>
              ))}
            </EnterpriseTableBody>
          </EnterpriseTable>
        ) : (
          <EmptyState compact title="No projects yet" description="Projects linked to this customer will appear here once they are created." />
        )}
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
                  <EnterpriseTableCell><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getEstimateStatusBadgeClass(estimate.status)}`}>{toTitleCase(estimate.status.replace(/_/g, " "))}</span></EnterpriseTableCell>
                  <EnterpriseTableCell>{formatProjectDate(estimate.issue_date, localeTag(locale), t("customers.notProvided"))}</EnterpriseTableCell>
                  <EnterpriseTableCell>{formatProjectCurrency(estimate.total_amount, localeTag(locale), t("customers.notProvided"))}</EnterpriseTableCell>
                  <EnterpriseTableCell align="right"><Link href={`/estimates/${estimate.id}`} className="font-semibold text-[var(--color-brand-700)] hover:text-[var(--color-brand-800)]">View</Link></EnterpriseTableCell>
                </EnterpriseTableRow>
              ))}
            </EnterpriseTableBody>
          </EnterpriseTable>
        ) : (
          <EmptyState compact title="No estimates yet" description="Estimates for this customer will appear here once they are created." />
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
                    <EnterpriseTableCell><InvoiceStatusPill status={invoice.status} /></EnterpriseTableCell>
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
          <EmptyState compact title="No invoices yet" description="Invoices for this customer will appear here once they are created." />
        )}
      </TabCard>
    );
  }

  function ActivityTab({ profile }: { profile: CustomerProfile; }) {
    const activityItems = buildActivityFeed(profile);

    return (
      <TabCard title="Activity" description="Recent customer activity based on real linked records.">
        {activityItems.length > 0 ? (
          <div className="space-y-3">
            {activityItems.map((item) => (
              <article key={item.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${item.tone}`}>
                    {item.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                      <p className="text-xs font-medium text-[var(--color-text-secondary)]">{item.timestamp}</p>
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.description}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState compact icon={<History size={18} />} title="No activity yet" description="Customer activity will appear here once projects, estimates, invoices, or notes are added." />
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

  function HeroBadge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "muted"; }) {
    const className = tone === "muted"
      ? "bg-white/10 text-white/80 ring-white/10"
      : "bg-white/12 text-white ring-white/12";

    return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${className}`}>{children}</span>;
  }

  function HeroMetric({ label, value, supportingText, icon, tone }: { label: string; value: string; supportingText?: string; icon: ReactNode; tone: HeroTone; }) {
    const toneClass: Record<HeroTone, string> = {
      blue: "bg-[rgba(59,130,246,0.24)]",
      green: "bg-[rgba(34,197,94,0.24)]",
      orange: "bg-[rgba(249,115,22,0.24)]",
      purple: "bg-[rgba(168,85,247,0.24)]",
      red: "bg-[rgba(239,68,68,0.24)]",
      cyan: "bg-[rgba(6,182,212,0.24)]",
    };

    return (
      <div className="rounded-[var(--radius-2xl)] border border-white/10 bg-white/[0.07] p-4 shadow-[0_12px_24px_-22px_rgb(15_23_42/0.55)]">
        <div className="flex items-start justify-between gap-4">
          <div className={`flex h-11 w-11 items-center justify-center rounded-full text-white shadow-[0_10px_18px_-14px_rgb(15_23_42/0.45)] ${toneClass[tone]}`}>
            {icon}
          </div>
        </div>

        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-white/60">{label}</p>
        <p className="mt-1 text-[1.8rem] font-bold tracking-[-0.04em] text-white">{value}</p>
        {supportingText ? <p className="mt-1 text-xs font-medium text-white/62">{supportingText}</p> : null}
      </div>
    );
  }

  function HeroInfoLine({ icon, label, value, subValue, multiline = false, tone = "blue" }: { icon: ReactNode; label: string; value: string; subValue?: string; multiline?: boolean; tone?: HeroTone; }) {
    const toneClass: Record<HeroTone, { bg: string; text: string }> = {
      blue: { bg: "bg-[rgba(59,130,246,0.22)]", text: "text-white" },
      green: { bg: "bg-[rgba(34,197,94,0.22)]", text: "text-white" },
      orange: { bg: "bg-[rgba(249,115,22,0.22)]", text: "text-white" },
      purple: { bg: "bg-[rgba(168,85,247,0.22)]", text: "text-white" },
      red: { bg: "bg-[rgba(239,68,68,0.22)]", text: "text-white" },
      cyan: { bg: "bg-[rgba(6,182,212,0.22)]", text: "text-white" },
    };

    return (
      <div className="rounded-[var(--radius-2xl)] border border-white/10 bg-white/[0.07] px-4 py-4 shadow-[0_12px_24px_-22px_rgb(15_23_42/0.5)]">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-11 w-11 items-center justify-center rounded-full ${toneClass[tone].bg} ${toneClass[tone].text} shadow-[0_10px_18px_-14px_rgb(15_23_42/0.45)]`}>
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium tracking-[-0.01em] text-white/72">{label}</p>
            <p className={`mt-1 text-sm font-semibold text-white ${multiline ? "whitespace-pre-line leading-6" : "truncate"}`}>{value}</p>
            {subValue ? <p className="mt-1 text-xs font-medium text-white/60">{subValue}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  function ActionMenuItem({ label, disabled = false, destructive = false }: { label: string; disabled?: boolean; destructive?: boolean; }) {
    return (
      <button
        type="button"
        disabled={disabled}
        className={`flex w-full items-center rounded-[var(--radius-lg)] px-3 py-2 text-left text-sm font-medium transition ${
          destructive ? "text-[var(--color-danger-700)] hover:bg-[var(--color-danger-50)]" : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]"
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {label}
      </button>
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

  function InvoiceStatusPill({ status }: { status: string; }) {
    return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getInvoiceStatusClass(status)}`}>{toTitleCase(status.replace(/_/g, " "))}</span>;
  }

  function buildActivityFeed(profile: CustomerProfile) {
    const items: Array<{ id: string; title: string; description: string; timestamp: string; tone: string; icon: ReactNode; }> = [];

    items.push({
      id: "customer-created",
      title: "Customer created",
      description: profile.customerName,
      timestamp: formatDate(profile.customer.created_at),
      tone: "bg-[var(--color-brand-600)]/15 text-[var(--color-brand-700)]",
      icon: <Users size={16} />,
    });

    if (profile.customer.updated_at !== profile.customer.created_at) {
      items.push({
        id: "customer-updated",
        title: "Customer updated",
        description: "Record details were updated.",
        timestamp: formatDate(profile.customer.updated_at),
        tone: "bg-[var(--color-info-500)]/15 text-[var(--color-info-700)]",
        icon: <Clock3 size={16} />,
      });
    }

    profile.activeProjects.slice(0, 5).forEach((project) => {
      items.push({
        id: `project-${project.id}`,
        title: "Project linked",
        description: project.name,
        timestamp: formatDate(project.created_at),
        tone: "bg-[var(--color-success-500)]/15 text-[var(--color-success-700)]",
        icon: <Building2 size={16} />,
      });
    });

    profile.estimates.slice(0, 5).forEach((estimate) => {
      items.push({
        id: `estimate-${estimate.id}`,
        title: estimate.status === "approved" ? "Estimate approved" : "Estimate created",
        description: estimate.title,
        timestamp: formatDate(estimate.created_at),
        tone: "bg-[var(--color-analytics-700)]/15 text-[var(--color-analytics-700)]",
        icon: <ReceiptText size={16} />,
      });
    });

    profile.invoices.slice(0, 5).forEach((invoice) => {
      items.push({
        id: `invoice-${invoice.id}`,
        title: "Invoice issued",
        description: invoice.title,
        timestamp: formatDate(invoice.issue_date || invoice.created_at),
        tone: "bg-[var(--color-warning-500)]/15 text-[var(--color-warning-700)]",
        icon: <ReceiptText size={16} />,
      });
    });

    return items.sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
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

  function badgeToneForTag(tag: string) {
    if (tag.toLowerCase().includes("active") || tag.toLowerCase().includes("repeat")) {
      return "success";
    }

    if (tag.toLowerCase().includes("commercial") || tag.toLowerCase().includes("customer")) {
      return "brand";
    }

    if (tag.toLowerCase().includes("lead") || tag.toLowerCase().includes("pending")) {
      return "warning";
    }

    return "neutral";
  }

  function getInvoiceStatusClass(status: string) {
    const normalized = status.trim().toLowerCase();
    const map: Record<string, string> = {
      draft: "bg-slate-100 text-slate-700 ring-slate-500/20",
      sent: "bg-blue-50 text-blue-700 ring-blue-600/20",
      viewed: "bg-cyan-50 text-cyan-700 ring-cyan-600/20",
      paid: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
      partial: "bg-amber-50 text-amber-700 ring-amber-600/20",
      partially_paid: "bg-amber-50 text-amber-700 ring-amber-600/20",
      overdue: "bg-rose-50 text-rose-700 ring-rose-600/20",
      void: "bg-zinc-100 text-zinc-700 ring-zinc-500/20",
    };

    return map[normalized] || map.draft;
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
