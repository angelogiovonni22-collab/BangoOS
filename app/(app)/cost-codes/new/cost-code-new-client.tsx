"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CostCodeForm } from "@/components/cost-codes";
import { Button, ErrorState, PageHeader } from "@/components/ui";
import { useCompany } from "@/lib/company";
import {
  EMPTY_COST_CODE_FORM,
  type CostCodeFormInput,
  type CostCodeParentOption,
  validateCostCodeInput,
} from "@/lib/cost-codes";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

export function NewCostCodeClient() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { companyName } = useCompany();

  const [form, setForm] = useState<CostCodeFormInput>(EMPTY_COST_CODE_FORM);
  const [parentOptions, setParentOptions] = useState<CostCodeParentOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadParentOptions = async () => {
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

      setParentOptions((data ?? []).map((row) => ({ id: row.id, code: row.code, name: row.name })));
    };

    void loadParentOptions();

    return () => {
      active = false;
    };
  }, [supabase]);

  const updateField = <K extends keyof CostCodeFormInput>(key: K, value: CostCodeFormInput[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));

    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const validation = validateCostCodeInput(form);

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

      const payload = {
        company_id: workspace.context.companyId,
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        status: form.status,
        division: form.division.trim() || null,
        category: form.category.trim() || null,
        trade: form.trade.trim() || null,
        parent_cost_code_id: form.parent_cost_code_id || null,
        default_labor_rate_id: form.default_labor_rate_id.trim() || null,
        default_material_category_id: form.default_material_category_id.trim() || null,
        default_equipment_category_id: form.default_equipment_category_id.trim() || null,
        budget: Number(form.budget),
        committed_cost: Number(form.committed_cost),
        actual_cost: Number(form.actual_cost),
        created_by: workspace.context.userId,
        updated_by: workspace.context.userId,
      };

      const { data, error } = await supabase
        .from("cost_codes")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (!data?.id) {
        setErrorMessage("Cost code was created but the redirect target was not returned.");
        return;
      }

      router.push(`/cost-codes/${data.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create cost code.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cost Controls"
        title="New Cost Code"
        description={`Create a new cost code for ${companyName || "your company"}.`}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <CostCodeForm value={form} parentOptions={parentOptions} onChange={updateField} disabled={isSaving} />

        {errorMessage ? <ErrorState compact title="Unable to save cost code" description={errorMessage} /> : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href="/cost-codes">
            <Button type="button" variant="outline" size="lg">Cancel</Button>
          </Link>
          <Button type="submit" size="lg" disabled={isSaving}>{isSaving ? "Saving..." : "Create Cost Code"}</Button>
        </div>
      </form>
    </div>
  );
}
