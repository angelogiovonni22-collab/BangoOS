"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LaborRateForm } from "@/components/labor-rates";
import { Button, ErrorState, PageHeader } from "@/components/ui";
import { useCompany } from "@/lib/company";
import {
  EMPTY_LABOR_RATE_FORM,
  calculateLaborRateSummary,
  type CostCodeOption,
  type LaborRateFormInput,
  validateLaborRateInput,
} from "@/lib/labor-rates";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

export function LaborRateNewClient() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { companyName } = useCompany();

  const [form, setForm] = useState<LaborRateFormInput>(EMPTY_LABOR_RATE_FORM);
  const [costCodeOptions, setCostCodeOptions] = useState<CostCodeOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadCostCodes = async () => {
      if (!supabase) {
        return;
      }

      const workspace = await resolveWorkspaceContext(supabase);

      if (!workspace.context || !active) {
        return;
      }

      const { data } = await supabase
        .from("cost_codes")
        .select("id, code, name")
        .eq("company_id", workspace.context.companyId)
        .order("code", { ascending: true });

      if (!active) {
        return;
      }

      setCostCodeOptions((data ?? []).map((row) => ({ id: row.id, code: row.code, name: row.name })));
    };

    void loadCostCodes();

    return () => {
      active = false;
    };
  }, [supabase]);

  const updateField = <K extends keyof LaborRateFormInput>(key: K, value: LaborRateFormInput[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));

    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

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
        company_id: workspace.context.companyId,
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

        created_by: workspace.context.userId,
        updated_by: workspace.context.userId,
      };

      const { data, error } = await supabase
        .from("labor_rates")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (!data?.id) {
        setErrorMessage("Labor rate was created but the redirect target was not returned.");
        return;
      }

      router.push(`/labor-rates/${data.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create labor rate.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Resource Costs"
        title="New Labor Rate"
        description={`Create a new labor rate profile for ${companyName || "your company"}.`}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <LaborRateForm value={form} costCodeOptions={costCodeOptions} onChange={updateField} disabled={isSaving} />

        {errorMessage ? <ErrorState compact title="Unable to save labor rate" description={errorMessage} /> : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href="/labor-rates">
            <Button type="button" variant="outline" size="lg">Cancel</Button>
          </Link>
          <Button type="submit" size="lg" disabled={isSaving}>{isSaving ? "Saving..." : "Create Labor Rate"}</Button>
        </div>
      </form>
    </div>
  );
}
