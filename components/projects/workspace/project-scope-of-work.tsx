"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Calculator,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  FileText,
  Hammer,
  Info,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

type EstimateRow = {
  id: string;
  estimate_number: string | null;
  title: string | null;
  description: string | null;
  status: string;
  subtotal: number | null;
  total_amount: number | null;
  internal_cost_total: number | null;
  gross_profit: number | null;
  gross_margin_percent: number | null;
  scope_inclusions: string | null;
  scope_exclusions: string | null;
  terms: string | null;
  payment_terms: string | null;
  customer_notes: string | null;
  internal_notes: string | null;
};

type EstimateLine = {
  id: string;
  sort_order: number;
  item_code: string | null;
  category: string | null;
  description: string;
  quantity: number;
  unit: string | null;
  unit_cost: number;
  unit_price: number;
  line_total: number;
  notes: string | null;
  material_id: string | null;
};

type ProjectScopeItem = {
  id: string;
  sort_order: number;
  category: string;
  scope_details: string;
  material_cost: number;
  labor_cost: number;
  status: string;
  color: string | null;
};

type ChangeOrderLineItem = {
  id: string;
  sort_order: number;
  description: string;
  cost_amount: number;
  price_amount: number;
  notes: string | null;
};

type ApprovedChangeOrder = {
  id: string;
  change_order_number: string;
  title: string;
  description: string | null;
  status: "approved" | "invoiced";
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  approved_at: string | null;
  effective_date: string | null;
  change_order_line_items: ChangeOrderLineItem[] | null;
};

type ScopeGroup = {
  id?: string;
  sortOrder?: number;
  name: string;
  description: string;
  materialCost: number;
  laborCost: number;
  totalCost: number;
  status: string;
  color: string;
};

type Props = {
  companyId: string;
  projectId: string;
  estimateId: string | null;
  localeTag: string;
};

const CATEGORY_COLORS = ["#5caeff", "#ffba27", "#20c9d9", "#3db3ff", "#ad7cff", "#ff69ae", "#ff7a78", "#70e1ec", "#bc75ef", "#ff84aa"];

export function ProjectScopeOfWork({ companyId, projectId, estimateId, localeTag }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [estimate, setEstimate] = useState<EstimateRow | null>(null);
  const [lines, setLines] = useState<EstimateLine[]>([]);
  const [savedScopeItems, setSavedScopeItems] = useState<ProjectScopeItem[]>([]);
  const [approvedChangeOrders, setApprovedChangeOrders] = useState<ApprovedChangeOrder[]>([]);
  const [scopeMaterialized, setScopeMaterialized] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editor, setEditor] = useState({ category: "", details: "", materialCost: "0", laborCost: "0", status: "planned" });
  const [savingScope, setSavingScope] = useState(false);
  const [scopeActionError, setScopeActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!supabase || !estimateId) {
      return () => { active = false; };
    }

    const db = supabase as unknown as {
      // Generated Supabase types can lag estimate/material-plan migrations.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      from: (table: string) => any;
    };

    const request = Promise.all([
      db
        .from("estimates")
        .select("id,estimate_number,title,description,status,subtotal,total_amount,internal_cost_total,gross_profit,gross_margin_percent,scope_inclusions,scope_exclusions,terms,payment_terms,customer_notes,internal_notes")
        .eq("company_id", companyId)
        .eq("id", estimateId)
        .maybeSingle(),
      db
        .from("estimate_line_items")
        .select("id,sort_order,item_code,category,description,quantity,unit,unit_cost,unit_price,line_total,notes,material_id")
        .eq("company_id", companyId)
        .eq("estimate_id", estimateId)
        .order("sort_order", { ascending: true }),
      db
        .from("project_scope_items")
        .select("id,sort_order,category,scope_details,material_cost,labor_cost,status,color")
        .eq("company_id", companyId)
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true }),
      db
        .from("change_orders")
        .select("id,change_order_number,title,description,status,subtotal,tax_amount,total_amount,approved_at,effective_date,change_order_line_items(id,sort_order,description,cost_amount,price_amount,notes)")
        .eq("company_id", companyId)
        .eq("project_id", projectId)
        .in("status", ["approved", "invoiced"])
        .is("archived_at", null)
        .order("approved_at", { ascending: true, nullsFirst: false }),
    ]);

    void request
      .then(([estimateResult, lineResult, scopeResult, changeOrderResult]) => {
        if (!active) return;
        if (estimateResult.error) throw new Error(estimateResult.error.message);
        if (lineResult.error) throw new Error(lineResult.error.message);
        if (scopeResult.error) throw new Error(scopeResult.error.message);
        if (changeOrderResult.error) throw new Error(changeOrderResult.error.message);

        setEstimate((estimateResult.data || null) as EstimateRow | null);
        setLines((lineResult.data || []) as EstimateLine[]);
        const scopeRows = (scopeResult.data || []) as ProjectScopeItem[];
        setSavedScopeItems(scopeRows);
        setScopeMaterialized(scopeRows.length > 0);
        setApprovedChangeOrders((changeOrderResult.data || []) as ApprovedChangeOrder[]);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load scope of work.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [companyId, estimateId, projectId, supabase]);

  const generatedScopeGroups = useMemo(() => buildScopeGroups(lines), [lines]);
  const scopeGroups = useMemo(
    () => scopeMaterialized ? savedScopeItems.map(scopeItemToGroup) : generatedScopeGroups,
    [generatedScopeGroups, savedScopeItems, scopeMaterialized],
  );
  const estimatedCost = Number(estimate?.internal_cost_total || lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_cost || 0), 0));
  const originalContractValue = Number(estimate?.total_amount || 0);
  const approvedChangeOrderValue = approvedChangeOrders.reduce((sum, changeOrder) => sum + Number(changeOrder.total_amount || 0), 0);
  const approvedChangeOrderCost = approvedChangeOrders.reduce(
    (sum, changeOrder) => sum + (changeOrder.change_order_line_items || []).reduce((lineSum, line) => lineSum + Number(line.cost_amount || 0), 0),
    0,
  );
  const currentContractValue = originalContractValue + approvedChangeOrderValue;
  const acceptedMaterialBudget = lines
    .filter((line) => normalizeCategory(line.category).includes("material"))
    .reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_cost || 0), 0);
  const acceptedLaborBudget = lines
    .filter((line) => normalizeCategory(line.category).includes("labor"))
    .reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_cost || 0), 0);
  const workingMaterialBudget = scopeGroups.reduce((sum, row) => sum + row.materialCost, 0);
  const workingLaborBudget = scopeGroups.reduce((sum, row) => sum + row.laborCost, 0);
  const workingCost = workingMaterialBudget + workingLaborBudget;
  const workingScopeVariance = roundCurrency(workingCost - estimatedCost);
  const liveScopeBaseCost = scopeMaterialized ? workingCost : estimatedCost;
  const currentEstimatedCost = liveScopeBaseCost + approvedChangeOrderCost;
  const currentGrossMargin = currentContractValue - currentEstimatedCost;
  const currentGrossMarginPercent = currentContractValue > 0 ? (currentGrossMargin / currentContractValue) * 100 : 0;
  const scopeSummary = estimate?.description?.trim() || lines.map((line) => line.description).filter(Boolean).join(" ") || "No scope summary has been entered yet.";

  const db = supabase as unknown as {
    // Generated Supabase types can lag project scope migrations.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
  };

  const materializeScopeItems = async () => {
    if (scopeMaterialized) return savedScopeItems;
    const payload = generatedScopeGroups.map((group, index) => ({
      company_id: companyId,
      project_id: projectId,
      estimate_id: estimateId,
      sort_order: index,
      category: group.name,
      scope_details: group.description,
      material_cost: group.materialCost,
      labor_cost: group.laborCost,
      status: normalizeScopeStatus(group.status),
      color: group.color,
      source_type: "estimate_allocation",
    }));
    const { data, error: insertError } = await db.from("project_scope_items").insert(payload).select("id,sort_order,category,scope_details,material_cost,labor_cost,status,color").order("sort_order");
    if (insertError) throw new Error(insertError.message);
    const rows = (data || []) as ProjectScopeItem[];
    setSavedScopeItems(rows);
    setScopeMaterialized(true);
    return rows;
  };

  const openAddScope = () => {
    setEditingIndex(null);
    setScopeActionError(null);
    setEditor({ category: "", details: "", materialCost: "0", laborCost: "0", status: "planned" });
    setEditorOpen(true);
  };

  const openEditScope = (group: ScopeGroup, index: number) => {
    setEditingIndex(index);
    setScopeActionError(null);
    setEditor({
      category: group.name,
      details: group.description,
      materialCost: String(group.materialCost),
      laborCost: String(group.laborCost),
      status: normalizeScopeStatus(group.status),
    });
    setEditorOpen(true);
  };

  const saveScopeItem = async () => {
    const category = editor.category.trim();
    const details = editor.details.trim();
    const materialCost = Number(editor.materialCost || 0);
    const laborCost = Number(editor.laborCost || 0);
    if (!category) {
      setScopeActionError("Category is required.");
      return;
    }
    if (materialCost < 0 || laborCost < 0 || !Number.isFinite(materialCost) || !Number.isFinite(laborCost)) {
      setScopeActionError("Material and labor costs must be valid non-negative numbers.");
      return;
    }

    setSavingScope(true);
    setScopeActionError(null);
    try {
      const rows = await materializeScopeItems();
      if (editingIndex === null) {
        const nextSort = rows.length ? Math.max(...rows.map((row) => row.sort_order)) + 1 : 0;
        const { data, error: insertError } = await db.from("project_scope_items").insert({
          company_id: companyId,
          project_id: projectId,
          estimate_id: estimateId,
          sort_order: nextSort,
          category,
          scope_details: details,
          material_cost: materialCost,
          labor_cost: laborCost,
          status: editor.status,
          color: CATEGORY_COLORS[nextSort % CATEGORY_COLORS.length],
          source_type: "manual",
        }).select("id,sort_order,category,scope_details,material_cost,labor_cost,status,color").single();
        if (insertError) throw new Error(insertError.message);
        setSavedScopeItems((current) => [...current, data as ProjectScopeItem].sort((a, b) => a.sort_order - b.sort_order));
      } else {
        const target = rows[editingIndex];
        if (!target) throw new Error("Scope line item could not be found.");
        const { data, error: updateError } = await db.from("project_scope_items").update({
          category,
          scope_details: details,
          material_cost: materialCost,
          labor_cost: laborCost,
          status: editor.status,
          updated_at: new Date().toISOString(),
        }).eq("company_id", companyId).eq("project_id", projectId).eq("id", target.id).select("id,sort_order,category,scope_details,material_cost,labor_cost,status,color").single();
        if (updateError) throw new Error(updateError.message);
        setSavedScopeItems((current) => current.map((row) => row.id === target.id ? data as ProjectScopeItem : row));
      }
      setEditorOpen(false);
      router.refresh();
    } catch (caught) {
      setScopeActionError(caught instanceof Error ? caught.message : "Unable to save scope line item.");
    } finally {
      setSavingScope(false);
    }
  };

  const removeScopeItem = async (index: number) => {
    if (!window.confirm("Remove this scope line item from the project working scope? The accepted estimate will not be changed.")) return;
    setSavingScope(true);
    setScopeActionError(null);
    try {
      const rows = await materializeScopeItems();
      const target = rows[index];
      if (!target) throw new Error("Scope line item could not be found.");
      const { error: deleteError } = await db.from("project_scope_items").delete().eq("company_id", companyId).eq("project_id", projectId).eq("id", target.id);
      if (deleteError) throw new Error(deleteError.message);
      setSavedScopeItems((current) => current.filter((row) => row.id !== target.id));
      router.refresh();
    } catch (caught) {
      setScopeActionError(caught instanceof Error ? caught.message : "Unable to remove scope line item.");
    } finally {
      setSavingScope(false);
    }
  };

  if (loading) {
    return <div className="rounded-[18px] border border-[#183d5c] bg-[#061624] p-6 text-sm font-semibold text-[#9fb7ca]">Loading scope of work…</div>;
  }

  if (!estimateId || !estimate) {
    return (
      <div className="rounded-[18px] border border-[#183d5c] bg-[#061624] p-6">
        <h2 className="text-lg font-black text-white">Scope of Work</h2>
        <p className="mt-2 text-sm text-[#9fb7ca]">This project does not have an accepted estimate linked yet.</p>
      </div>
    );
  }

  if (error) {
    return <div className="rounded-[18px] border border-red-400/30 bg-red-400/5 p-6 text-sm font-semibold text-red-200">{error}</div>;
  }

  return (
    <div className="space-y-4 rounded-[18px] bg-[#07182a] text-[#eaf4ff]" data-project-scope-of-work>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6" data-scope-financial-snapshot>
        <SummaryCard icon={<CircleDollarSign size={22} />} label="Original Contract" value={money(originalContractValue, localeTag)} sub="Signed estimate value" />
        <SummaryCard icon={<Plus size={22} />} label="Approved Change Orders" value={`+${money(approvedChangeOrderValue, localeTag)}`} sub={approvedChangeOrders.length ? `${approvedChangeOrders.length} approved` : "No approved changes"} />
        <SummaryCard icon={<CheckCircle2 size={22} />} label="Current Contract" value={money(currentContractValue, localeTag)} sub="Signed contract + customer COs" />
        <SummaryCard icon={<Calculator size={22} />} label="Projected Cost" value={money(currentEstimatedCost, localeTag)} sub="Live scope + approved CO cost" />
        <SummaryCard icon={<BarChart3 size={22} />} label="Projected Gross Profit" value={money(currentGrossMargin, localeTag)} sub={`${Number(currentGrossMarginPercent || 0).toFixed(1)}% projected margin`} />
        <SummaryCard icon={<ClipboardList size={22} />} label="Working Scope" value={money(workingCost, localeTag)} sub={`${scopeGroups.length} categories · editable`} />
      </div>

      <div className="flex flex-wrap justify-end gap-2" data-scope-actions>
        <Link href={`/estimates/${estimate.id}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#318ef1] bg-[linear-gradient(180deg,#2f8cff,#156dd1)] px-4 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(20,105,210,.20)] transition hover:brightness-110">
          <FileText size={16} /> View Original Estimate
        </Link>
        <button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#315b7c] bg-[#0a2135] px-4 text-sm font-extrabold text-white transition hover:bg-[#0d2b47]">
          Export Scope <ChevronDown size={15} />
        </button>
      </div>

      {(scopeMaterialized && Math.abs(workingScopeVariance) >= 0.01) || (approvedChangeOrderCost > 0 && approvedChangeOrderValue <= 0) ? (
        <div className="rounded-[14px] border border-amber-400/30 bg-amber-400/[0.055] px-4 py-3" data-scope-reconciliation>
          <div className="flex items-center gap-2">
            <Info size={16} className="text-amber-300" aria-hidden="true" />
            <p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-amber-300">Scope Reconciliation</p>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {scopeMaterialized && Math.abs(workingScopeVariance) >= 0.01 ? (
              <div className="rounded-xl border border-amber-300/20 bg-black/10 px-3 py-2">
                <p className="text-[10px] font-extrabold uppercase tracking-[.06em] text-[#d7b96b]">Working Scope Variance</p>
                <p className="mt-1 text-base font-black text-white">{workingScopeVariance > 0 ? "+" : ""}{money(workingScopeVariance, localeTag)}</p>
                <p className="mt-1 text-[11px] font-semibold text-[#d8cba8]">{money(workingCost, localeTag)} working scope vs. {money(estimatedCost, localeTag)} accepted estimate cost.</p>
              </div>
            ) : null}
            {approvedChangeOrderCost > 0 && approvedChangeOrderValue <= 0 ? (
              <div className="rounded-xl border border-amber-300/20 bg-black/10 px-3 py-2">
                <p className="text-[10px] font-extrabold uppercase tracking-[.06em] text-[#d7b96b]">Change Order Margin Impact</p>
                <p className="mt-1 text-base font-black text-white">-{money(approvedChangeOrderCost, localeTag)}</p>
                <p className="mt-1 text-[11px] font-semibold text-[#d8cba8]">{money(approvedChangeOrderValue, localeTag)} customer price · {money(approvedChangeOrderCost, localeTag)} internal cost.</p>
              </div>
            ) : null}
          </div>
          <p className="mt-2 text-[11px] text-[#c9b98f]">The signed estimate remains unchanged. Projected cost and margin follow the live working scope plus approved change-order cost.</p>
        </div>
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,1fr)]">
        <div className="h-fit self-start">
          <Panel title="Scope of Work Summary" icon={<FileText size={21} />} action={<Link href={`/estimates/${estimate.id}`} className={outlineButton}><Pencil size={14} /> Edit</Link>}>
            <p className="text-[15px] leading-6 text-[#d7e4ef]">{scopeSummary}</p>
          </Panel>
        </div>

        <Panel title="Trade / Scope Summary" icon={<BarChart3 size={21} />}>
          <div className="space-y-2.5">
            {scopeGroups.map((group) => {
              const scopeTotal = scopeGroups.reduce((sum, row) => sum + row.totalCost, 0);
              const ratio = scopeTotal > 0 ? group.totalCost / scopeTotal : 0;
              return (
                <div key={group.name} className="grid grid-cols-[minmax(0,1fr)_88px_46px_96px] items-center gap-2 text-xs">
                  <div className="flex min-w-0 items-center gap-2 font-bold text-[#dce9f4]"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: group.color }} /><span className="truncate">{group.name}</span></div>
                  <span className="text-right font-black text-white">{money(group.totalCost, localeTag)}</span>
                  <span className="text-right font-bold text-[#a8bfd2]">{Math.round(ratio * 100)}%</span>
                  <span className="h-2 overflow-hidden rounded-full bg-[#102d45]"><span className="block h-full rounded-full" style={{ width: `${Math.max(4, ratio * 100)}%`, background: group.color }} /></span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel title="Itemized Scope & Cost Breakdown" icon={<Hammer size={21} />} action={<button type="button" onClick={openAddScope} className={outlineButton}><Plus size={14} /> Add Category</button>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] table-fixed border-collapse">
            <thead>
              <tr className="border-b border-[#1f4564] text-left text-[11px] font-extrabold uppercase tracking-[.07em] text-[#83a0b8]">
                <th className="w-[30px] px-1.5 py-2.5">#</th>
                <th className="w-[105px] px-1.5 py-2.5">Category</th>
                <th className="px-1.5 py-2.5">Scope Details</th>
                <th className="w-[82px] px-1.5 py-2.5 text-right">Materials Cost</th>
                <th className="w-[76px] px-1.5 py-2.5 text-right">Labor Cost</th>
                <th className="w-[82px] px-1.5 py-2.5 text-right">Total Cost</th>
                <th className="w-[126px] px-1.5 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {scopeGroups.map((group, index) => (
                <tr key={group.name + index} className="border-b border-[#16344d] text-sm last:border-b-0">
                  <td className="px-1.5 py-2.5 font-semibold text-[#b6c9d9]">{index + 1}</td>
                  <td className="px-1.5 py-2.5">
                    <div className="flex items-center gap-2 font-extrabold text-white"><span className="h-2.5 w-2.5 rounded-full" style={{ background: group.color }} />{group.name}</div>
                  </td>
                  <td className="max-w-[370px] px-2 py-2.5 text-xs leading-5 text-[#c4d4e2]">{group.description}</td>
                  <td className="px-1.5 py-2.5 text-right font-bold">{money(group.materialCost, localeTag)}</td>
                  <td className="px-1.5 py-2.5 text-right font-bold">{money(group.laborCost, localeTag)}</td>
                  <td className="px-1.5 py-2.5 text-right font-black text-white">{money(group.totalCost, localeTag)}</td>
                  <td className="px-1.5 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <StatusPill status={group.status} />
                      <button type="button" onClick={() => openEditScope(group, index)} className="grid h-8 w-8 place-items-center rounded-lg border border-[#315a78] bg-[#092239] text-[#b9d7ec] hover:bg-[#0d2d49]" aria-label={`Edit ${group.name}`}><Pencil size={13} /></button>
                      <button type="button" onClick={() => void removeScopeItem(index)} disabled={savingScope} className="grid h-8 w-8 place-items-center rounded-lg border border-red-400/25 bg-red-400/[0.06] text-red-300 hover:bg-red-400/10 disabled:opacity-50" aria-label={`Remove ${group.name}`}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!scopeGroups.length ? <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-[#8da7bb]">No scope line items have been added to the project yet.</td></tr> : null}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#315a78] bg-[#081c2d] text-sm font-black text-white">
                <td className="px-2 py-3" colSpan={3}>Working Scope Cost</td>
                <td className="px-2 py-3 text-right">{money(workingMaterialBudget, localeTag)}</td>
                <td className="px-2 py-3 text-right">{money(workingLaborBudget, localeTag)}</td>
                <td className="px-2 py-3 text-right">{money(workingCost, localeTag)}</td>
                <td />
              </tr>
              <tr className="border-t border-[#315a78] bg-[#0b2940] text-sm font-black text-white" data-accepted-estimate-baseline>
                <td className="px-2 py-3" colSpan={3}>Accepted Estimate Baseline <span className="ml-2 text-[10px] font-semibold text-cyan-200">(signed · immutable)</span></td>
                <td className="px-2 py-3 text-right text-cyan-100">{money(acceptedMaterialBudget, localeTag)}</td>
                <td className="px-2 py-3 text-right text-cyan-100">{money(acceptedLaborBudget, localeTag)}</td>
                <td className="px-2 py-3 text-right text-cyan-100">{money(estimatedCost, localeTag)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {approvedChangeOrders.length ? (
          <section className="mt-4 rounded-[14px] border border-cyan-400/25 bg-cyan-400/[0.045] p-3" data-approved-change-orders-section>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-cyan-200">Approved Change Orders</p>
                <p className="mt-1 text-xs text-[#a9c6d8]">Customer-approved amendments stay separate from the editable base scope and roll into projected project cost.</p>
              </div>
              <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-extrabold text-cyan-100">{approvedChangeOrders.length} approved</span>
            </div>
            <div className="mt-3 grid gap-2">
              {approvedChangeOrders.map((changeOrder) => {
                const internalCost = (changeOrder.change_order_line_items || []).reduce((sum, line) => sum + Number(line.cost_amount || 0), 0);
                const marginImpact = Number(changeOrder.total_amount || 0) - internalCost;
                return (
                  <div key={changeOrder.id} className="grid gap-3 rounded-xl border border-cyan-300/20 bg-[#082033] p-3 md:grid-cols-[minmax(0,1fr)_120px_120px_120px_auto] md:items-center">
                    <div className="min-w-0">
                      <Link href={`/change-orders/${changeOrder.id}`} className="text-xs font-extrabold text-cyan-100 hover:underline">{changeOrder.change_order_number} · {changeOrder.title}</Link>
                      <p className="mt-1 text-xs leading-5 text-[#bfd4e2]">{changeOrderScopeDetails(changeOrder)}</p>
                    </div>
                    <MetricMini label="Customer Price" value={money(changeOrder.total_amount, localeTag)} />
                    <MetricMini label="Internal Cost" value={money(internalCost, localeTag)} />
                    <MetricMini label="Margin Impact" value={`${marginImpact >= 0 ? "+" : ""}${money(marginImpact, localeTag)}`} />
                    <Link href={`/change-orders/${changeOrder.id}`} className={outlineButton}>View</Link>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {scopeActionError ? <p className="mt-2 rounded-lg border border-red-400/30 bg-red-400/[0.06] px-3 py-2 text-xs font-semibold text-red-200">{scopeActionError}</p> : null}
        <p className="mt-2 text-[11px] leading-4 text-[#8fa9bd]">Material and labor costs are managed directly in the editable base scope above. Approved change orders remain separate, stay linked to their signed customer approval record, and roll into Projected Cost without changing the accepted estimate baseline.</p>
      </Panel>

      <Panel title="Notes / Inclusions / Exclusions" icon={<FileText size={21} />} action={<Link href={`/estimates/${estimate.id}`} className={outlineButton}><Pencil size={14} /> Edit</Link>}>
        <div className="grid gap-5 md:grid-cols-3">
          <NotesColumn title="Inclusions" icon={<CheckCircle2 size={20} className="text-emerald-400" />} text={estimate.scope_inclusions} fallback="All labor and materials per approved estimate scope." />
          <NotesColumn title="Exclusions" icon={<span className="grid h-5 w-5 place-items-center rounded-full bg-amber-400 text-[12px] font-black text-[#17202c]">!</span>} text={estimate.scope_exclusions} fallback="No exclusions have been entered." />
          <NotesColumn title="Notes" icon={<Info size={20} className="text-sky-400" />} text={estimate.customer_notes || estimate.internal_notes || estimate.payment_terms} fallback="No additional scope notes have been entered." />
        </div>
      </Panel>

      {editorOpen ? (
        <div className="fixed inset-0 z-[120] flex items-stretch justify-center overflow-hidden bg-slate-950/75 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={editingIndex === null ? "Add scope line item" : "Edit scope line item"}>
          <div className="flex h-[100dvh] w-full max-w-xl flex-col overflow-hidden border border-[#2b5f84] bg-[#071827] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)] shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-[10px] font-extrabold uppercase tracking-[.09em] text-[#68baff]">Project Scope</p><h3 className="mt-1 text-xl font-black text-white">{editingIndex === null ? "Add Line Item" : "Edit Line Item"}</h3></div>
              <button type="button" onClick={() => setEditorOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg border border-[#315a78] text-[#bcd2e3] hover:bg-[#0d2d49]" aria-label="Close"><X size={17} /></button>
            </div>
            <div className="mt-5 grid min-h-0 flex-1 content-start gap-4 overflow-y-auto pr-1">
              <label className="grid gap-1.5 text-xs font-bold text-[#b9cedf]">Category<input value={editor.category} onChange={(event) => setEditor((current) => ({ ...current, category: event.target.value }))} className={inputClass} placeholder="e.g. Plumbing" /></label>
              <label className="grid gap-1.5 text-xs font-bold text-[#b9cedf]">Scope Details<textarea value={editor.details} onChange={(event) => setEditor((current) => ({ ...current, details: event.target.value }))} className={inputClass + " min-h-24 resize-y"} placeholder="Describe the work included in this line item." /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-bold text-[#b9cedf]">Materials Cost<input type="number" min="0" step="0.01" value={editor.materialCost} onChange={(event) => setEditor((current) => ({ ...current, materialCost: event.target.value }))} className={inputClass} /></label>
                <label className="grid gap-1.5 text-xs font-bold text-[#b9cedf]">Labor Cost<input type="number" min="0" step="0.01" value={editor.laborCost} onChange={(event) => setEditor((current) => ({ ...current, laborCost: event.target.value }))} className={inputClass} /></label>
              </div>
              <label className="grid gap-1.5 text-xs font-bold text-[#b9cedf]">Status<select value={editor.status} onChange={(event) => setEditor((current) => ({ ...current, status: event.target.value }))} className={inputClass}><option value="planned">Planned</option><option value="ordered">Ordered</option><option value="in_progress">In Progress</option><option value="complete">Complete</option><option value="on_hold">On Hold</option></select></label>
              {scopeActionError ? <p className="rounded-lg border border-red-400/30 bg-red-400/[0.06] px-3 py-2 text-xs font-semibold text-red-200">{scopeActionError}</p> : null}
            </div>
            <div className="mt-5 flex shrink-0 justify-end gap-2 border-t border-[#234760] pt-4">
              <button type="button" onClick={() => setEditorOpen(false)} className={outlineButton}>Cancel</button>
              <button type="button" disabled={savingScope} onClick={() => void saveScopeItem()} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#318ef1] bg-[linear-gradient(180deg,#2f8cff,#156dd1)] px-4 text-xs font-extrabold text-white disabled:opacity-50"><Save size={14} />{savingScope ? "Saving…" : "Save Line Item"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const inputClass = "w-full rounded-lg border border-[#315a78] bg-[#061521] px-3 py-2.5 text-sm font-semibold text-white outline-none placeholder:text-[#55728a] focus:border-[#4ca8f6] focus:ring-2 focus:ring-[#2d8ae8]/20";
const panelClass = "rounded-[17px] border border-[#1d4564] bg-[linear-gradient(180deg,#071a2b,#061624)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.025)]";
const outlineButton = "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-[#2f678f] bg-[#092239] px-3 text-xs font-extrabold text-[#dcefff] transition hover:bg-[#0d2d49]";

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#244b67] bg-[#0a2135] px-3 py-2">
      <p className="text-[9px] font-extrabold uppercase tracking-[.07em] text-[#83a0b8]">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}

function SummaryCard({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub: string }) {
  return <div className="rounded-[14px] border border-[#1d4564] bg-[linear-gradient(180deg,#08203a,#07182a)] p-3"><div className="flex items-start gap-2.5"><span className="mt-0.5 text-[#51b5ff]">{icon}</span><div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[.07em] text-[#83a4be]">{label}</p><p className="mt-1 whitespace-nowrap text-[17px] font-black leading-5 text-white">{value}</p><p className="mt-0.5 text-[11px] font-semibold text-[#8ba6ba]">{sub}</p></div></div></div>;
}

function Panel({ title, icon, action, children }: { title: string; icon: ReactNode; action?: ReactNode; children: ReactNode }) {
  return <section className={panelClass}><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2.5"><span className="text-[#8fc8ff]">{icon}</span><h2 className="text-lg font-black tracking-[-.015em] text-white">{title}</h2></div>{action}</div>{children}</section>;
}

function NotesColumn({ title, icon, text, fallback }: { title: string; icon: ReactNode; text: string | null; fallback: string }) {
  const rows = splitNotes(text || fallback);
  return <div className="min-w-0 border-[#234760] md:border-r md:pr-5 last:border-r-0"><div className="flex items-center gap-2"><span>{icon}</span><h3 className="text-sm font-extrabold text-white">{title}</h3></div><ul className="mt-2 space-y-1 text-xs leading-5 text-[#c7d5e1]">{rows.map((row, index) => <li key={index} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#7ea1ba]" /><span>{row}</span></li>)}</ul></div>;
}

function StatusPill({ status }: { status: string }) {
  const normalized = normalizeScopeStatus(status);
  const style = normalized.includes("complete") ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : normalized.includes("progress") ? "border-sky-400/40 bg-sky-400/10 text-sky-300" : normalized.includes("order") ? "border-amber-400/40 bg-amber-400/10 text-amber-300" : "border-[#3a617c] bg-[#0d2a43] text-[#c8def0]";
  return <span className={`inline-flex rounded-full border px-3 py-1.5 text-[10px] font-extrabold ${style}`}>{scopeStatusLabel(status)}</span>;
}

function changeOrderScopeDetails(changeOrder: ApprovedChangeOrder) {
  const lineDescriptions = (changeOrder.change_order_line_items || [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((line) => line.description.trim())
    .filter(Boolean);
  return lineDescriptions.join(" · ") || changeOrder.description?.trim() || "Approved change to project scope.";
}

function scopeItemToGroup(item: ProjectScopeItem): ScopeGroup {
  return {
    id: item.id,
    sortOrder: item.sort_order,
    name: item.category,
    description: item.scope_details,
    materialCost: Number(item.material_cost || 0),
    laborCost: Number(item.labor_cost || 0),
    totalCost: roundCurrency(Number(item.material_cost || 0) + Number(item.labor_cost || 0)),
    status: scopeStatusLabel(item.status),
    color: item.color || CATEGORY_COLORS[item.sort_order % CATEGORY_COLORS.length],
  };
}

function normalizeScopeStatus(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function scopeStatusLabel(value: string) {
  return titleCase(normalizeScopeStatus(value));
}

const CANONICAL_SCOPE = [
  { name: "Demo", details: "Remove existing fixtures, tile, drywall, and haul debris.", materialWeight: 650, laborWeight: 1800 },
  { name: "Framing", details: "Minor framing for plumbing and fixture adjustments.", materialWeight: 300, laborWeight: 900 },
  { name: "Plumbing", details: "Rough-in, new supply lines, drain, and fixture installation.", materialWeight: 1950, laborWeight: 2250 },
  { name: "Electrical", details: "New lighting, fan, GFCI, and switches.", materialWeight: 1200, laborWeight: 1600 },
  { name: "Drywall", details: "Patch and install new drywall, tape and finish.", materialWeight: 400, laborWeight: 1250 },
  { name: "Painting", details: "Prime and paint walls and ceiling.", materialWeight: 320, laborWeight: 1100 },
  { name: "Flooring", details: "Tile or LVT flooring with required setting materials and finish.", materialWeight: 1450, laborWeight: 1650 },
  { name: "Trim", details: "Baseboards, door trim, casing, quarter round, and finish carpentry.", materialWeight: 350, laborWeight: 700 },
  { name: "Windows", details: "Bathroom window work when applicable.", materialWeight: 600, laborWeight: 600 },
  { name: "Appliances / Fixtures", details: "Vanity, toilet, shower/tub, faucet, shower glass, hardware, and related fixtures.", materialWeight: 3272, laborWeight: 1000 },
] as const;

function buildScopeGroups(lines: EstimateLine[]): ScopeGroup[] {
  const materialBudget = roundCurrency(lines
    .filter((line) => normalizeCategory(line.category).includes("material"))
    .reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_cost || 0), 0));
  const laborBudget = roundCurrency(lines
    .filter((line) => normalizeCategory(line.category).includes("labor"))
    .reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_cost || 0), 0));

  const materialWeightTotal = CANONICAL_SCOPE.reduce((sum, row) => sum + row.materialWeight, 0);
  const laborWeightTotal = CANONICAL_SCOPE.reduce((sum, row) => sum + row.laborWeight, 0);

  const groups = CANONICAL_SCOPE.map((row, index) => {
    const materialCost = materialBudget > 0 ? roundCurrency((materialBudget * row.materialWeight) / materialWeightTotal) : 0;
    const laborCost = laborBudget > 0 ? roundCurrency((laborBudget * row.laborWeight) / laborWeightTotal) : 0;
    return {
      name: row.name,
      description: row.details,
      materialCost,
      laborCost,
      totalCost: roundCurrency(materialCost + laborCost),
      status: "Planned",
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    };
  });

  if (groups.length) {
    const last = groups[groups.length - 1];
    const materialResidual = roundCurrency(materialBudget - groups.reduce((sum, row) => sum + row.materialCost, 0));
    const laborResidual = roundCurrency(laborBudget - groups.reduce((sum, row) => sum + row.laborCost, 0));
    last.materialCost = roundCurrency(last.materialCost + materialResidual);
    last.laborCost = roundCurrency(last.laborCost + laborResidual);
    last.totalCost = roundCurrency(last.materialCost + last.laborCost);
  }

  return groups;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeCategory(value: string | null | undefined) { return (value || "").trim().toLowerCase(); }
function titleCase(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function splitNotes(value: string) { return value.split(/\n|•|;/g).map((row) => row.trim().replace(/^[-–—]\s*/, "")).filter(Boolean); }
function money(value: number, localeTag: string) { return new Intl.NumberFormat(localeTag, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value || 0)); }
