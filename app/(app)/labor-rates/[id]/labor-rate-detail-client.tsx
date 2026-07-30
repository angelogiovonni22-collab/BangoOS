"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, ErrorState, SkeletonLoader, StatusBadge, SummaryCard } from "@/components/ui";
import { formatPercent, formatUsdCurrency, type LaborRateFormInput, type LaborRateRow } from "@/lib/labor-rates";
import { calculateLaborRateSummary } from "@/lib/labor-rates/validation";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

export function LaborRateDetailClient() {
  const params = useParams<{ id?: string | string[] }>();
  const laborRateId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const supabase = useMemo(() => createClient(), []);

  const [laborRate, setLaborRate] = useState<LaborRateRow | null>(null);
  const [defaultCostCodeLabel, setDefaultCostCodeLabel] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setNotFound(false);

      if (!supabase) {
        if (active) {
          setErrorMessage("Unable to connect right now. Please try again shortly.");
          setIsLoading(false);
        }

        return;
      }

      if (!laborRateId) {
        if (active) {
          setErrorMessage("Unable to read labor rate id.");
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

        const { data, error } = await supabase
          .from("labor_rates")
          .select("*")
          .eq("id", laborRateId)
          .eq("company_id", workspace.context.companyId)
          .maybeSingle<LaborRateRow>();

        if (!active) {
          return;
        }

        if (error) {
          setErrorMessage(error.message);
          setIsLoading(false);
          return;
        }

        if (!data) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }

        setLaborRate(data);

        if (data.default_cost_code_id) {
          const { data: costCodeData } = await supabase
            .from("cost_codes")
            .select("code, name")
            .eq("company_id", workspace.context.companyId)
            .eq("id", data.default_cost_code_id)
            .maybeSingle<{ code: string; name: string }>();

          if (active) {
            setDefaultCostCodeLabel(costCodeData ? `${costCodeData.code} ${costCodeData.name}` : null);
          }
        } else {
          setDefaultCostCodeLabel(null);
        }
      } catch (error) {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load labor rate.");
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
  }, [laborRateId, supabase]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonLoader className="h-8 w-80" />
        <SkeletonLoader className="h-24 w-full" />
        <SkeletonLoader className="h-64 w-full" />
      </div>
    );
  }

  if (errorMessage) {
    return <ErrorState title="Unable to load labor rate" description={errorMessage} />;
  }

  if (notFound || !laborRate) {
    return (
      <EmptyState
        title="Labor rate not found"
        description="This labor rate could not be located in your company workspace."
        action={<Link href="/labor-rates"><Badge tone="brand">Back to labor rates</Badge></Link>}
      />
    );
  }

  const calculationInput: LaborRateFormInput = {
    code: laborRate.code,
    name: laborRate.name,
    description: laborRate.description || "",
    status: laborRate.status as LaborRateFormInput["status"],
    trade: laborRate.trade || "",
    position_title: laborRate.position_title || "",
    skill_level: (laborRate.skill_level as LaborRateFormInput["skill_level"]) || "",
    employment_type: (laborRate.employment_type as LaborRateFormInput["employment_type"]) || "",
    union_status: (laborRate.union_status as LaborRateFormInput["union_status"]) || "",
    worker_classification: (laborRate.worker_classification as LaborRateFormInput["worker_classification"]) || "",
    default_cost_code_id: laborRate.default_cost_code_id || "",
    currency_code: laborRate.currency_code,
    base_hourly_rate: String(laborRate.base_hourly_rate),
    overtime_multiplier: String(laborRate.overtime_multiplier),
    double_time_multiplier: String(laborRate.double_time_multiplier),
    weekend_multiplier: String(laborRate.weekend_multiplier),
    holiday_multiplier: String(laborRate.holiday_multiplier),
    shift_differential: String(laborRate.shift_differential),
    bonus_hourly_allocation: String(laborRate.bonus_hourly_allocation),
    payroll_tax_hourly: String(laborRate.payroll_tax_hourly),
    workers_comp_hourly: String(laborRate.workers_comp_hourly),
    health_insurance_hourly: String(laborRate.health_insurance_hourly),
    retirement_hourly: String(laborRate.retirement_hourly),
    paid_time_off_hourly: String(laborRate.paid_time_off_hourly),
    training_hourly: String(laborRate.training_hourly),
    vehicle_allowance_hourly: String(laborRate.vehicle_allowance_hourly),
    phone_allowance_hourly: String(laborRate.phone_allowance_hourly),
    tool_allowance_hourly: String(laborRate.tool_allowance_hourly),
    uniform_hourly: String(laborRate.uniform_hourly),
    other_burden_hourly: String(laborRate.other_burden_hourly),
    overhead_markup_percent: String(laborRate.overhead_markup_percent),
    profit_markup_percent: String(laborRate.profit_markup_percent),
    production_unit: laborRate.production_unit || "",
    production_rate: laborRate.production_rate !== null ? String(laborRate.production_rate) : "",
    production_period: (laborRate.production_period as LaborRateFormInput["production_period"]) || "",
    crew_size: laborRate.crew_size !== null ? String(laborRate.crew_size) : "",
    notes: laborRate.notes || "",
  };

  const calculations = calculateLaborRateSummary(calculationInput);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
        <Link href="/labor-rates" className="text-[var(--color-brand-700)] transition hover:text-[var(--color-brand-800)]">Labor Rates</Link>
        <span>/</span>
        <span>{laborRate.code}</span>
      </div>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-5 shadow-[var(--shadow-medium)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">{laborRate.code}</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{laborRate.name}</p>
            <div className="mt-3 flex items-center gap-2">
              <StatusBadge status={laborRate.status} />
            </div>
          </div>

          <Link href={`/labor-rates/${laborRate.id}/edit`} className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--color-brand-600)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-700)]">
            Edit Labor Rate
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={<span>B</span>} label="Base Rate" value={formatUsdCurrency(calculations.baseRate, laborRate.currency_code)} context="Hourly" tone="brand" />
        <SummaryCard icon={<span>T</span>} label="True Hourly Cost" value={formatUsdCurrency(calculations.trueHourlyCost, laborRate.currency_code)} context={`Burden ${formatPercent(calculations.burdenPercentage)}`} tone="info" />
        <SummaryCard icon={<span>R</span>} label="Billable Hourly Rate" value={formatUsdCurrency(calculations.billableHourlyRate, laborRate.currency_code)} context={`Gross margin ${formatUsdCurrency(calculations.grossMarginPerHour, laborRate.currency_code)}`} tone="warning" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Code" value={laborRate.code} />
            <InfoRow label="Name" value={laborRate.name} />
            <InfoRow label="Description" value={laborRate.description} />
            <InfoRow label="Status" value={laborRate.status} />
            <InfoRow label="Trade" value={laborRate.trade} />
            <InfoRow label="Position" value={laborRate.position_title} />
            <InfoRow label="Skill level" value={laborRate.skill_level} />
            <InfoRow label="Classification" value={laborRate.worker_classification} />
            <InfoRow label="Union status" value={laborRate.union_status} />
            <InfoRow label="Default cost code" value={defaultCostCodeLabel} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Compensation</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Base hourly rate" value={formatUsdCurrency(laborRate.base_hourly_rate, laborRate.currency_code)} />
            <InfoRow label="Shift differential" value={formatUsdCurrency(laborRate.shift_differential, laborRate.currency_code)} />
            <InfoRow label="Bonus allocation" value={formatUsdCurrency(laborRate.bonus_hourly_allocation, laborRate.currency_code)} />
            <InfoRow label="Overtime rate" value={formatUsdCurrency(calculations.overtimePayRate, laborRate.currency_code)} />
            <InfoRow label="Double-time rate" value={formatUsdCurrency(calculations.doubleTimePayRate, laborRate.currency_code)} />
            <InfoRow label="Weekend rate" value={formatUsdCurrency(calculations.weekendPayRate, laborRate.currency_code)} />
            <InfoRow label="Holiday rate" value={formatUsdCurrency(calculations.holidayPayRate, laborRate.currency_code)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Burden</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Payroll tax" value={formatUsdCurrency(laborRate.payroll_tax_hourly, laborRate.currency_code)} />
            <InfoRow label="Workers comp" value={formatUsdCurrency(laborRate.workers_comp_hourly, laborRate.currency_code)} />
            <InfoRow label="Health insurance" value={formatUsdCurrency(laborRate.health_insurance_hourly, laborRate.currency_code)} />
            <InfoRow label="Retirement" value={formatUsdCurrency(laborRate.retirement_hourly, laborRate.currency_code)} />
            <InfoRow label="Paid time off" value={formatUsdCurrency(laborRate.paid_time_off_hourly, laborRate.currency_code)} />
            <InfoRow label="Training" value={formatUsdCurrency(laborRate.training_hourly, laborRate.currency_code)} />
            <InfoRow label="Vehicle allowance" value={formatUsdCurrency(laborRate.vehicle_allowance_hourly, laborRate.currency_code)} />
            <InfoRow label="Phone allowance" value={formatUsdCurrency(laborRate.phone_allowance_hourly, laborRate.currency_code)} />
            <InfoRow label="Tool allowance" value={formatUsdCurrency(laborRate.tool_allowance_hourly, laborRate.currency_code)} />
            <InfoRow label="Uniform" value={formatUsdCurrency(laborRate.uniform_hourly, laborRate.currency_code)} />
            <InfoRow label="Other burden" value={formatUsdCurrency(laborRate.other_burden_hourly, laborRate.currency_code)} />
            <InfoRow label="Total hourly burden" value={formatUsdCurrency(calculations.totalBurdenHourly, laborRate.currency_code)} />
            <InfoRow label="Burden percentage" value={formatPercent(calculations.burdenPercentage)} />
            <InfoRow label="True hourly cost" value={formatUsdCurrency(calculations.trueHourlyCost, laborRate.currency_code)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pricing</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="True hourly cost" value={formatUsdCurrency(calculations.trueHourlyCost, laborRate.currency_code)} />
            <InfoRow label="Overhead markup" value={formatPercent(laborRate.overhead_markup_percent)} />
            <InfoRow label="Profit markup" value={formatPercent(laborRate.profit_markup_percent)} />
            <InfoRow label="Billable hourly rate" value={formatUsdCurrency(calculations.billableHourlyRate, laborRate.currency_code)} />
            <InfoRow label="Estimated gross margin per hour" value={formatUsdCurrency(calculations.grossMarginPerHour, laborRate.currency_code)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Productivity</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Production rate" value={laborRate.production_rate !== null ? String(laborRate.production_rate) : null} />
            <InfoRow label="Production unit" value={laborRate.production_unit} />
            <InfoRow label="Production period" value={laborRate.production_period} />
            <InfoRow label="Crew size" value={laborRate.crew_size !== null ? String(laborRate.crew_size) : null} />
            <InfoRow label="Notes" value={laborRate.notes} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Metadata</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Created" value={new Date(laborRate.created_at).toLocaleString()} />
            <InfoRow label="Updated" value={new Date(laborRate.updated_at).toLocaleString()} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.06em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-0.5 text-sm text-[var(--color-text-primary)]">{value?.trim() || "-"}</p>
    </div>
  );
}
