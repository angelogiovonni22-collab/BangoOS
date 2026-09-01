"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CostCodeForm } from "@/components/cost-codes";
import { Button, EmptyState, ErrorState, PageHeader, SkeletonLoader } from "@/components/ui";
import { useCompany } from "@/lib/company";
import {
  EMPTY_COST_CODE_FORM,
  type CostCodeFormInput,
  type CostCodeParentOption,
  type CostCodeRow,
  validateCostCodeInput,
} from "@/lib/cost-codes";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

export function EditCostCodeClient() {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const costCodeId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const supabase = useMemo(() => createClient(), []);
  const { companyName } = useCompany();

  const [costCode, setCostCode] = useState<CostCodeRow | null>(null);
  const [form, setForm] = useState<CostCodeFormInput>(EMPTY_COST_CODE_FORM);
  const [parentOptions, setParentOptions] = useState<CostCodeParentOption[]>([]);
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

      if (!costCodeId) {
        if (active) {
          setErrorMessage("Unable to read cost code id.");
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

        const [costCodeResult, parentResult] = await Promise.all([
          supabase
            .from("cost_codes")
            .select("*")
            .eq("id", costCodeId)
            .eq("company_id", workspace.context.companyId)
            .maybeSingle<CostCodeRow>(),
          supabase
            .from("cost_codes")
            .select("id, code, name")
            .eq("company_id", workspace.context.companyId)
            .order("code", { ascending: true }),
        ]);

        if (!active) {
          return;
        }

        if (parentResult.data) {
          setParentOptions(
            parentResult.data
              .filter((row) => row.id !== costCodeId)
              .map((row) => ({ id: row.id, code: row.code, name: row.name })),
          );
        }

        if (costCodeResult.error) {
          setErrorMessage(costCodeResult.error.message);
          setIsLoading(false);
          return;
        }

        if (!costCodeResult.data) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }

        const data = costCodeResult.data;
        setCostCode(data);
        setForm({
          code: data.code,
          name: data.name,
          description: data.description || "",
          status: data.status as CostCodeFormInput["status"],
          division: data.division || "",
          category: data.category || "",
          trade: data.trade || "",
          parent_cost_code_id: data.parent_cost_code_id || "",
          default_labor_rate_id: data.default_labor_rate_id || "",
          default_material_category_id: data.default_material_category_id || "",
          default_equipment_category_id: data.default_equipment_category_id || "",
          budget: String(data.budget),
          committed_cost: String(data.committed_cost),
          actual_cost: String(data.actual_cost),
        });
      } catch (error) {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load cost code.");
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
  }, [costCodeId, supabase]);

  const updateField = <K extends keyof CostCodeFormInput>(key: K, value: CostCodeFormInput[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));

    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!costCode) {
      setErrorMessage("Cost code record is unavailable.");
      return;
    }

    const validation = validateCostCodeInput(form);

    if (!validation.isValid) {
      setErrorMessage(validation.errors[0] || "Please review the form.");
      return;
    }

    if (form.parent_cost_code_id && form.parent_cost_code_id === costCode.id) {
      setErrorMessage("A cost code cannot be its own parent.");
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
        updated_by: workspace.context.userId,
      };

      const { error } = await supabase
        .from("cost_codes")
        .update(payload)
        .eq("id", costCode.id)
        .eq("company_id", workspace.context.companyId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.push(`/cost-codes/${costCode.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update cost code.");
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
    return <ErrorState title="Unable to load cost code" description={errorMessage} />;
  }

  if (notFound || !costCode) {
    return (
      <EmptyState
        title="Cost code not found"
        description="This cost code could not be located in your company workspace."
        action={<Link href="/cost-codes" className={getButtonClassName({})}>Back to cost codes</Link>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cost Controls"
        title="Edit Cost Code"
        description={`Update cost code details for ${companyName || "your company"}.`}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <CostCodeForm value={form} parentOptions={parentOptions} onChange={updateField} disabled={isSaving} />

        {errorMessage ? <ErrorState compact title="Unable to save cost code" description={errorMessage} /> : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href={`/cost-codes/${costCode.id}`}>
            <Button type="button" variant="outline" size="lg">Cancel</Button>
          </Link>
          <Button type="submit" size="lg" disabled={isSaving}>{isSaving ? "Saving..." : "Save Changes"}</Button>
        </div>
      </form>
    </div>
  );
}
