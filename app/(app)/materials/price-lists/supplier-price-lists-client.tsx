"use client";

import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, History, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, CardContent, EmptyState, ErrorState, FormField, Input, PageHeader, Select, SkeletonLoader, TableContainer, getButtonClassName } from "@/components/ui";
import { parseSupplierPriceCsv, type SupplierPriceImportRow } from "@/lib/materials/supplier-price-lists";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

type VendorOption = { id: string; display_name: string };
type PriceListRow = {
  id: string;
  vendor_id: string;
  list_name: string;
  branch_name: string | null;
  effective_on: string;
  verified_on: string;
  source_filename: string;
  row_count: number;
  matched_count: number;
  status: string;
  created_at: string;
};

const today = () => new Date().toISOString().slice(0, 10);

export function SupplierPriceListsClient() {
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [companyId, setCompanyId] = useState("");
  const [userId, setUserId] = useState("");
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [lists, setLists] = useState<PriceListRow[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [listName, setListName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [effectiveOn, setEffectiveOn] = useState(today);
  const [verifiedOn, setVerifiedOn] = useState(today);
  const [expiresOn, setExpiresOn] = useState("");
  const [sourceFilename, setSourceFilename] = useState("");
  const [previewRows, setPreviewRows] = useState<SupplierPriceImportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    if (!supabase) {
      setErrorMessage("Unable to connect right now. Please try again shortly.");
      setIsLoading(false);
      return;
    }

    const workspace = await resolveWorkspaceContext(supabase);
    if (!workspace.context) {
      setErrorMessage(workspace.errorMessage || "Unable to verify your workspace.");
      setIsLoading(false);
      return;
    }

    const [{ data: vendorData, error: vendorError }, { data: listData, error: listError }] = await Promise.all([
      supabase.from("vendors").select("id, display_name").eq("company_id", workspace.context.companyId).eq("status", "active").order("display_name"),
      supabase.from("supplier_price_lists").select("id, vendor_id, list_name, branch_name, effective_on, verified_on, source_filename, row_count, matched_count, status, created_at").eq("company_id", workspace.context.companyId).order("effective_on", { ascending: false }),
    ]);

    if (vendorError || listError) {
      setErrorMessage(vendorError?.message || listError?.message || "Unable to load supplier price lists.");
      setIsLoading(false);
      return;
    }

    setCompanyId(workspace.context.companyId);
    setUserId(workspace.context.userId);
    setVendors((vendorData ?? []) as VendorOption[]);
    setLists((listData ?? []) as PriceListRow[]);
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadWorkspace(), 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkspace]);

  const invalidRows = previewRows.filter((row) => row.errors.length > 0).length;
  const validRows = previewRows.length - invalidRows;
  const vendorNames = useMemo(() => Object.fromEntries(vendors.map((vendor) => [vendor.id, vendor.display_name])), [vendors]);

  const handleFile = async (file: File | undefined) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setPreviewRows([]);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErrorMessage("Choose a CSV file. Excel workbook import will be added after this CSV foundation is approved.");
      return;
    }

    const parsed = parseSupplierPriceCsv(await file.text());
    if (parsed.rows.length === 0) {
      setErrorMessage("No price rows were found. The first row must contain column headings.");
      return;
    }
    setSourceFilename(file.name);
    setListName((current) => current || file.name.replace(/\.csv$/i, ""));
    setPreviewRows(parsed.rows);
  };

  const handleImport = async () => {
    if (!supabase || !companyId || !userId || !vendorId || !listName.trim() || !sourceFilename || validRows === 0) return;
    if (invalidRows > 0) {
      setErrorMessage("Correct or remove every flagged row before importing this list.");
      return;
    }

    setIsImporting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    const rows = previewRows.map((row) => ({
      supplier_sku: row.supplierSku,
      product_description: row.productDescription,
      manufacturer: row.manufacturer,
      model_number: row.modelNumber,
      package_quantity: row.packageQuantity,
      unit_of_measure: row.unitOfMeasure,
      unit_price: row.unitPrice,
      contractor_price: row.contractorPrice,
      availability: row.availability,
      source_row: row.sourceRow,
    }));

    const { error } = await supabase.rpc("import_supplier_price_list", {
      p_company_id: companyId,
      p_vendor_id: vendorId,
      p_list_name: listName.trim(),
      p_branch_name: branchName.trim(),
      p_effective_on: effectiveOn,
      p_expires_on: expiresOn || null,
      p_verified_on: verifiedOn,
      p_source_filename: sourceFilename,
      p_rows: rows,
    });

    if (error) {
      setErrorMessage(error.message);
      setIsImporting(false);
      return;
    }

    setSuccessMessage(`${validRows} supplier prices were imported. Existing price history was preserved.`);
    setPreviewRows([]);
    setSourceFilename("");
    setListName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsImporting(false);
    await loadWorkspace();
  };

  if (isLoading) return <div className="space-y-4"><SkeletonLoader className="h-12 w-80" /><SkeletonLoader className="h-72 w-full" /></div>;
  if (errorMessage && !companyId) return <ErrorState title="Unable to load supplier prices" description={errorMessage} />;

  return (
    <div className="container-content space-y-[var(--space-section)]">
      <PageHeader
        eyebrow="Materials · Supplier pricing"
        title="Supplier Price Lists"
        description="Import dated supplier prices, validate every row, and preserve the source and price history before using costs in estimates."
        primaryAction={<Link href="/materials" className={getButtonClassName({ variant: "outline" })}><ArrowLeft size={16} />Materials catalog</Link>}
      />

      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white"><Upload size={20} /></div>
            <div><h2 className="font-semibold text-slate-950">Import a current supplier list</h2><p className="text-sm text-slate-600">CSV is enabled for the first release. Prices append as a dated list; they never overwrite earlier imports.</p></div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <FormField label="Supplier" required><Select value={vendorId} onChange={(event) => setVendorId(event.target.value)}><option value="">Select supplier</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.display_name}</option>)}</Select></FormField>
            <FormField label="List name" required><Input value={listName} onChange={(event) => setListName(event.target.value)} placeholder="Spring contractor pricing" /></FormField>
            <FormField label="Store / branch"><Input value={branchName} onChange={(event) => setBranchName(event.target.value)} placeholder="Columbus West" /></FormField>
            <FormField label="Effective date" required><Input type="date" value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} /></FormField>
            <FormField label="Verified date" required><Input type="date" value={verifiedOn} onChange={(event) => setVerifiedOn(event.target.value)} /></FormField>
            <FormField label="Expiration date"><Input type="date" min={effectiveOn} value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} /></FormField>
          </div>

          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
            <label className="flex cursor-pointer items-center gap-3">
              <FileSpreadsheet className="text-blue-700" size={24} />
              <span><span className="block font-medium text-slate-900">Choose supplier CSV</span><span className="text-sm text-slate-600">Required: SKU, description, and unit price. Optional aliases for brand, model, pack, UOM, contractor price, and availability are detected automatically.</span></span>
              <input ref={fileInputRef} className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => void handleFile(event.target.files?.[0])} />
            </label>
          </div>

          {errorMessage ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div> : null}
          {successMessage ? <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{successMessage}</div> : null}

          {previewRows.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-950">Validation preview</h3><p className="text-sm text-slate-600">{validRows} ready · {invalidRows} require attention</p></div><Button disabled={isImporting || invalidRows > 0 || !vendorId || !listName.trim()} onClick={() => void handleImport()}>{isImporting ? "Importing…" : `Confirm ${validRows} prices`}</Button></div>
              <TableContainer title="Rows ready to import" description="Flagged rows must be corrected in the source CSV and uploaded again.">
                <div className="max-h-[420px] overflow-auto"><table className="w-full min-w-[900px] text-sm"><thead className="sticky top-0 bg-slate-900 text-left text-white"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">SKU</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Pack / UOM</th><th className="px-3 py-2 text-right">List</th><th className="px-3 py-2 text-right">Contractor</th><th className="px-3 py-2">Availability</th><th className="px-3 py-2">Validation</th></tr></thead><tbody>{previewRows.map((row) => <tr key={row.rowNumber} className="border-b border-slate-200"><td className="px-3 py-2 text-slate-500">{row.rowNumber}</td><td className="px-3 py-2 font-medium">{row.supplierSku || "—"}</td><td className="px-3 py-2">{row.productDescription || "—"}</td><td className="px-3 py-2">{row.packageQuantity} / {row.unitOfMeasure}</td><td className="px-3 py-2 text-right">${row.unitPrice.toFixed(2)}</td><td className="px-3 py-2 text-right">{row.contractorPrice === null ? "—" : `$${row.contractorPrice.toFixed(2)}`}</td><td className="px-3 py-2">{row.availability || "Not provided"}</td><td className="px-3 py-2">{row.errors.length ? <span className="text-red-700">{row.errors.join("; ")}</span> : <Badge tone="success">Ready</Badge>}</td></tr>)}</tbody></table></div>
              </TableContainer>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center gap-2"><History size={19} className="text-blue-700" /><div><h2 className="font-semibold text-slate-950">Import history</h2><p className="text-sm text-slate-600">Every dated upload remains available for verification and future price comparisons.</p></div></div>
        {lists.length === 0 ? <EmptyState title="No supplier price lists yet" description="Choose an active vendor and upload the first CSV price list." /> : <TableContainer title="Supplier price-list history" description="Earlier effective dates remain available as an audit trail."><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm"><thead className="bg-slate-900 text-left text-white"><tr><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Price list</th><th className="px-4 py-3">Effective</th><th className="px-4 py-3">Verified</th><th className="px-4 py-3">Rows</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{lists.map((list) => <tr key={list.id} className="border-b border-slate-200"><td className="px-4 py-3 font-medium">{vendorNames[list.vendor_id] || "Supplier"}{list.branch_name ? <span className="block text-xs font-normal text-slate-500">{list.branch_name}</span> : null}</td><td className="px-4 py-3">{list.list_name}</td><td className="px-4 py-3">{list.effective_on}</td><td className="px-4 py-3">{list.verified_on}</td><td className="px-4 py-3">{list.row_count}</td><td className="px-4 py-3 text-slate-600">{list.source_filename}</td><td className="px-4 py-3"><Badge tone={list.status === "active" ? "success" : "neutral"}>{list.status}</Badge></td></tr>)}</tbody></table></div></TableContainer>}
      </section>
    </div>
  );
}
