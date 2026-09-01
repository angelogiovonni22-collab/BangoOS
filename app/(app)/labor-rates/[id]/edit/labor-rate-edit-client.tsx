"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LaborRateForm } from "@/components/labor-rates";
import { Button, EmptyState, ErrorState, PageHeader, SkeletonLoader, getButtonClassName } from "@/components/ui";
import { useCompany } from "@/lib/company";
import {
  EMPTY_LABOR_RATE_FORM,
  calculateLaborRateSummary,
  type CostCodeOption,
  type LaborRateFormInput,
  type LaborRateRow,
  validateLaborRateInput,
} from "@/lib/labor-rates";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

export function LaborRateEditClient() {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const laborRateId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const supabase = useMemo(() => createClient(), []);
  const { companyName } = useCompany();

  const [laborRate, setLaborRate] = useState<LaborRateRow | null>(null);
  const [form, setForm] = useState<LaborRateFormInput>(EMPTY_LABOR_RATE_FORM);
  const [costCodeOptions, setCostCodeOptions] = useState<CostCodeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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

        const [laborRateResult, costCodesResult] = await Promise.all([
          supabase
            .from("labor_rates")
            .select("*")
            .eq("id", laborRateId)
            .eq("company_id", workspace.context.companyId)
            .maybeSingle<LaborRateRow>(),
          supabase
            .from("cost_codes")
            .select("id, code, name")
            .eq("company_id", workspace.context.companyId)
            .order("code", { ascending: true }),
        ]);

        if (!active) {
          return;
        }

        if (costCodesResult.data) {
          setCostCodeOptions(costCodesResult.data.map((row) => ({ id: row.id, code: row.code, name: row.name })));
        }

        if (laborRateResult.error) {
          setErrorMessage(laborRateResult.error.message);
          setIsLoading(false);
          return;
        }

        if (!laborRateResult.data) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }

        const data = laborRateResult.data;
        setLaborRate(data);
        setForm({
          code: data.code,
          name: data.name,
          description: data.description || "",
          status: data.status as LaborRateFormInput["status"],
          trade: data.trade || "",
          position_title: data.position_title || "",
          skill_level: (data.skill_level as LaborRateFormInput["skill_level"]) || "",
          employment_type: (data.employment_type as LaborRateFormInput["employment_type"]) || "",
          union_status: (data.union_status as LaborRateFormInput["union_status"]) || "",
          worker_classification: (data.worker_classification as LaborRateFormInput["worker_classification"]) || "",
          default_cost_code_id: data.default_cost_code_id || "",
          currency_code: data.currency_code,
          base_hourly_rate: String(data.base_hourly_rate),
          overtime_multiplier: String(data.overtime_multiplier),
          double_time_multiplier: String(data.double_time_multiplier),
          weekend_multiplier: String(data.weekend_multiplier),
          holiday_multiplier: String(data.holiday_multiplier),
          shift_differential: String(data.shift_differential),
          bonus_hourly_allocation: String(data.bonus_hourly_allocation),
          payroll_tax_hourly: String(data.payroll_tax_hourly),
          workers_comp_hourly: String(data.workers_comp_hourly),
          health_insurance_hourly: String(data.health_insurance_hourly),
          retirement_hourly: String(data.retirement_hourly),
          paid_time_off_hourly: String(data.paid_time_off_hourly),
          training_hourly: String(data.training_hourly),
          vehicle_allowance_hourly: String(data.vehicle_allowance_hourly),
          phone_allowance_hourly: String(data.phone_allowance_hourly),
          tool_allowance_hourly: String(data.tool_allowance_hourly),
          uniform_hourly: String(data.uniform_hourly),
          other_burden_hourly: String(data.other_burden_hourly),
          overhead_markup_percent: String(data.overhead_markup_percent),
          profit_markup_percent: String(data.profit_markup_percent),
          production_unit: data.production_unit || "",
          production_rate: data.production_rate !== null ? String(data.production_rate) : "",
          production_period: (data.production_period as LaborRateFormInput["production_period"]) || "",
          crew_size: data.crew_size !== null ? String(data.crew_size) : "",
          notes: data.notes || "",
        });
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

  const updateField = <K extends keyof LaborRateFormInput>(key: K, value: LaborRateFormInput[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));

    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!laborRate) {
      setErrorMessage("Labor rate record is unavailable.");
      return;
    }

    const allowedCostCodeIds = costCodeOptions.map((option) => option.id);
    const validation = validateLaborRateInput(form, { allowedCostCodeIds });

    if (!validation.isValid) {
      setErrorMessage(validation.errors[0] || "Please review the form.");
      return;
    }

    if (!supabase) {
      setErrorMessage("Unable to connect right now. Please try again shortly.");
      return;
    }

    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const workspace = await resolveWorkspaceContext(supabase);

      if (!workspace.context) {
        setErrorMessage(workspace.errorMessage || "Unable to verify your workspace.");
        return;
      }

      const calculations = calculateLaborRateSummary(form);

      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        status: form.status,
        trade: form.trade.trim() || null,
        position_title: form.position_title.trim() || null,
        skill_level: form.skill_level || null,
        employment_type: form.employment_type || null,
        union_status: form.union_status || null,
        worker_classification: form.worker_classification || null,
        default_cost_code_id: form.default_cost_code_id || null,
        currency_code: form.currency_code.trim().toUpperCase(),

        base_hourly_rate: Number(form.base_hourly_rate),
        overtime_multiplier: Number(form.overtime_multiplier),
        double_time_multiplier: Number(form.double_time_multiplier),
        weekend_multiplier: Number(form.weekend_multiplier),
        holiday_multiplier: Number(form.holiday_multiplier),
        shift_differential: Number(form.shift_differential),
        bonus_hourly_allocation: Number(form.bonus_hourly_allocation),

        payroll_tax_hourly: Number(form.payroll_tax_hourly),
        workers_comp_hourly: Number(form.workers_comp_hourly),
        health_insurance_hourly: Number(form.health_insurance_hourly),
        retirement_hourly: Number(form.retirement_hourly),
        paid_time_off_hourly: Number(form.paid_time_off_hourly),
        training_hourly: Number(form.training_hourly),
        vehicle_allowance_hourly: Number(form.vehicle_allowance_hourly),
        phone_allowance_hourly: Number(form.phone_allowance_hourly),
        tool_allowance_hourly: Number(form.tool_allowance_hourly),
        uniform_hourly: Number(form.uniform_hourly),
        other_burden_hourly: Number(form.other_burden_hourly),

        total_burden_hourly: calculations.totalBurdenHourly,
        true_hourly_cost: calculations.trueHourlyCost,
        overhead_markup_percent: Number(form.overhead_markup_percent),
        profit_markup_percent: Number(form.profit_markup_percent),
        billable_hourly_rate: calculations.billableHourlyRate,

        production_unit: form.production_unit.trim() || null,
        production_rate: form.production_rate.trim() ? Number(form.production_rate) : null,
        production_period: form.production_period || null,
        crew_size: form.crew_size.trim() ? Number(form.crew_size) : null,
        notes: form.notes.trim() || null,
        updated_by: workspace.context.userId,
      };

      const { error } = await supabase
        .from("labor_rates")
        .update(payload)
        .eq("id", laborRate.id)
        .eq("company_id", workspace.context.companyId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.push(`/labor-rates/${laborRate.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update labor rate.");
    } finally {
      setIsSaving(false);
    }
  };

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
        action={<Link href="/labor-rates" className={getButtonClassName({})}>Back to labor rates</Link>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Resource Costs"
        title="Edit Labor Rate"
        description={`Update labor cost and pricing details for ${companyName || "your company"}.`}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <LaborRateForm value={form} costCodeOptions={costCodeOptions} onChange={updateField} disabled={isSaving} />

        {errorMessage ? <ErrorState compact title="Unable to save labor rate" description={errorMessage} /> : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href={`/labor-rates/${laborRate.id}`}>
            <Button type="button" variant="outline" size="lg">Cancel</Button>
          </Link>
          <Button type="submit" size="lg" disabled={isSaving}>{isSaving ? "Saving..." : "Save Changes"}</Button>
        </div>
      </form>
    </div>
  );
}
