import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { NextResponse } from "next/server";
import { buildProjectFinancialReport } from "@/lib/financial-reporting";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";

const MAX_RECEIPT_BYTES = 20 * 1024 * 1024;
const ALLOWED_RECEIPT_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const RECEIPT_CATEGORIES = new Set(["materials", "tools", "equipment", "safety", "consumables", "tax", "other"]);

type ReceiptItemInput = {
  description: string;
  quantity: number;
  unit_price: number | null;
  line_total: number;
  category: string;
  cost_code_id?: string | null;
  confidence?: number | null;
};

type ReceiptExtraction = {
  vendor_name: string | null;
  receipt_number: string | null;
  purchased_at: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  payment_method: string | null;
  currency_code: string;
  confidence: number;
  items: ReceiptItemInput[];
};

type ReceiptPatchBody = {
  action?: "approve" | "reject";
  receiptId?: string;
  vendorName?: string | null;
  receiptNumber?: string | null;
  purchasedAt?: string | null;
  subtotal?: number | null;
  taxAmount?: number | null;
  totalAmount?: number | null;
  paymentMethod?: string | null;
  items?: ReceiptItemInput[];
  confirmDuplicate?: boolean;
};

async function getProjectContext(id: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error("B.O.S. database is unavailable.");

  const workspace = await resolveWorkspaceContext(supabase as SupabaseClient<Database>);
  if (!workspace.context) throw new Error(workspace.errorMessage || "Unauthorized.");

  const { data: project, error } = await supabase
    .from("projects")
    .select("id,name,contract_amount,estimated_cost")
    .eq("company_id", workspace.context.companyId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message || "Unable to load project.");
  if (!project) throw new Error("Project not found.");

  return { supabase, workspace: workspace.context, project };
}

function asUntypedDb(supabase: SupabaseClient<Database>) {
  // Receipt tables are migration-backed and may land before generated Supabase types are refreshed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

function safeFilename(filename: string) {
  const normalized = filename
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-120);
  return normalized || "receipt.jpg";
}

function finiteMoney(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function finiteQuantity(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 1;
}

function normalizeConfidence(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : value;
}

function normalizeExtraction(raw: unknown): ReceiptExtraction {
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const rawItems = Array.isArray(source.items) ? source.items : [];

  const items = rawItems
    .map((item): ReceiptItemInput | null => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const description = typeof row.description === "string" ? row.description.trim().slice(0, 500) : "";
      if (!description) return null;
      const quantity = finiteQuantity(row.quantity);
      const unitPrice = finiteMoney(row.unit_price);
      const lineTotal = finiteMoney(row.line_total) ?? Math.round(((unitPrice ?? 0) * quantity + Number.EPSILON) * 100) / 100;
      const requestedCategory = typeof row.category === "string" ? row.category.trim().toLowerCase() : "materials";
      return {
        description,
        quantity,
        unit_price: unitPrice,
        line_total: lineTotal,
        category: RECEIPT_CATEGORIES.has(requestedCategory) ? requestedCategory : "other",
        confidence: normalizeConfidence(row.confidence),
      };
    })
    .filter((item): item is ReceiptItemInput => item !== null)
    .slice(0, 100);

  return {
    vendor_name: typeof source.vendor_name === "string" ? source.vendor_name.trim().slice(0, 200) || null : null,
    receipt_number: typeof source.receipt_number === "string" ? source.receipt_number.trim().slice(0, 120) || null : null,
    purchased_at: normalizeDate(source.purchased_at),
    subtotal: finiteMoney(source.subtotal),
    tax_amount: finiteMoney(source.tax_amount),
    total_amount: finiteMoney(source.total_amount),
    payment_method: typeof source.payment_method === "string" ? source.payment_method.trim().slice(0, 120) || null : null,
    currency_code: typeof source.currency_code === "string" && /^[A-Za-z]{3}$/.test(source.currency_code)
      ? source.currency_code.toUpperCase()
      : "USD",
    confidence: normalizeConfidence(source.confidence),
    items,
  };
}

async function extractReceipt(buffer: Buffer, mimeType: string): Promise<ReceiptExtraction> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return normalizeExtraction({});
  }

  const client = new OpenAI({ apiKey, timeout: 30_000, maxRetries: 1 });
  const model = process.env.BANGO_RECEIPT_MODEL || "gpt-4o-mini";
  const imageUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;

  const completion = await client.chat.completions.create({
    model,
    temperature: 0,
    max_tokens: 2200,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You read construction material purchase receipts for B.O.S. Return only accurate JSON. Never infer a price, date, vendor, item, tax, total, or payment method that is not visible. Use null when uncertain. Monetary values are decimal numbers without currency symbols. purchased_at must be YYYY-MM-DD or null. category must be one of materials, tools, equipment, safety, consumables, tax, other. confidence values range from 0 to 1.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract this receipt. Return JSON with vendor_name, receipt_number, purchased_at, subtotal, tax_amount, total_amount, payment_method, currency_code, confidence, and items. Each item must have description, quantity, unit_price, line_total, category, confidence. Include only visible purchased line items; do not invent missing values.",
          },
          { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
        ],
      },
    ],
  });

  const rawText = completion.choices[0]?.message?.content || "{}";
  try {
    return normalizeExtraction(JSON.parse(rawText));
  } catch {
    return normalizeExtraction({});
  }
}

async function getReceiptPayload(supabase: SupabaseClient<Database>, companyId: string, projectId: string) {
  const db = asUntypedDb(supabase);
  const [receiptResponse, itemResponse, report] = await Promise.all([
    db
      .from("project_receipts")
      .select("id,project_id,uploaded_by,storage_path,original_filename,mime_type,file_size,vendor_name,receipt_number,purchased_at,subtotal,tax_amount,total_amount,currency_code,payment_method,status,extraction_confidence,duplicate_of,approved_by,approved_at,created_at,updated_at")
      .eq("company_id", companyId)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("project_receipt_items")
      .select("id,receipt_id,description,quantity,unit_price,line_total,category,cost_code_id,extraction_confidence")
      .eq("company_id", companyId)
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    buildProjectFinancialReport({ supabase, companyId, projectId }),
  ]);

  if (receiptResponse.error) throw new Error(receiptResponse.error.message);
  if (itemResponse.error) throw new Error(itemResponse.error.message);

  const itemsByReceipt = new Map<string, unknown[]>();
  for (const item of itemResponse.data ?? []) {
    const rows = itemsByReceipt.get(item.receipt_id) || [];
    rows.push(item);
    itemsByReceipt.set(item.receipt_id, rows);
  }

  const receipts = await Promise.all((receiptResponse.data ?? []).map(async (receipt: Record<string, unknown>) => {
    const storagePath = typeof receipt.storage_path === "string" ? receipt.storage_path : "";
    const signed = storagePath
      ? await supabase.storage.from("project-receipts").createSignedUrl(storagePath, 60 * 30)
      : { data: null, error: null };
    return {
      ...receipt,
      items: itemsByReceipt.get(String(receipt.id)) || [],
      previewUrl: signed.error ? null : signed.data?.signedUrl || null,
    };
  }));

  const approvedReceiptSpend = receipts.reduce((sum, receipt) => {
    if (receipt.status !== "approved") return sum;
    const total = typeof receipt.total_amount === "number" ? receipt.total_amount : Number(receipt.total_amount || 0);
    return sum + (Number.isFinite(total) ? total : 0);
  }, 0);

  return {
    receipts,
    financials: {
      ...report.summary,
      approvedReceiptSpend: Math.round((approvedReceiptSpend + Number.EPSILON) * 100) / 100,
      remainingContractDollars: Math.round((Math.max(report.summary.revisedContractValue - report.summary.actualCost, 0) + Number.EPSILON) * 100) / 100,
    },
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, workspace } = await getProjectContext(id);
    const payload = await getReceiptPayload(supabase, workspace.companyId, id);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load project receipts." }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, workspace } = await getProjectContext(id);
    const db = asUntypedDb(supabase);
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a receipt image to upload." }, { status: 400 });
    }
    if (!ALLOWED_RECEIPT_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Receipt must be a JPEG, PNG, or WebP image." }, { status: 415 });
    }
    if (file.size <= 0 || file.size > MAX_RECEIPT_BYTES) {
      return NextResponse.json({ error: "Receipt image must be between 1 byte and 20 MB." }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileSha256 = createHash("sha256").update(buffer).digest("hex");
    const duplicateResponse = await db
      .from("project_receipts")
      .select("id,project_id,vendor_name,total_amount,status,created_at")
      .eq("company_id", workspace.companyId)
      .eq("file_sha256", fileSha256)
      .neq("status", "rejected")
      .maybeSingle();

    if (duplicateResponse.error) throw new Error(duplicateResponse.error.message);
    if (duplicateResponse.data) {
      return NextResponse.json({
        error: "This exact receipt has already been uploaded.",
        duplicate: duplicateResponse.data,
      }, { status: 409 });
    }

    const storagePath = `${workspace.companyId}/${id}/${randomUUID()}-${safeFilename(file.name)}`;
    const insertResponse = await db
      .from("project_receipts")
      .insert({
        company_id: workspace.companyId,
        project_id: id,
        uploaded_by: workspace.userId,
        storage_path: storagePath,
        original_filename: file.name || "receipt.jpg",
        mime_type: file.type,
        file_size: file.size,
        file_sha256: fileSha256,
        status: "processing",
      })
      .select("id")
      .single();

    if (insertResponse.error || !insertResponse.data) {
      throw new Error(insertResponse.error?.message || "Unable to create receipt record.");
    }

    const receiptId = String(insertResponse.data.id);
    const uploadResponse = await supabase.storage
      .from("project-receipts")
      .upload(storagePath, buffer, { contentType: file.type, upsert: false });

    if (uploadResponse.error) {
      await db.from("project_receipts").update({ status: "failed" }).eq("id", receiptId);
      throw new Error(uploadResponse.error.message || "Unable to store receipt image.");
    }

    let extraction: ReceiptExtraction;
    try {
      extraction = await extractReceipt(buffer, file.type);
    } catch (extractionError) {
      console.error("Receipt extraction failed:", extractionError);
      extraction = normalizeExtraction({});
    }

    let duplicateOf: string | null = null;
    if (extraction.vendor_name && extraction.purchased_at && extraction.total_amount !== null) {
      const possibleDuplicate = await db
        .from("project_receipts")
        .select("id")
        .eq("company_id", workspace.companyId)
        .neq("id", receiptId)
        .neq("status", "rejected")
        .ilike("vendor_name", extraction.vendor_name)
        .eq("purchased_at", extraction.purchased_at)
        .eq("total_amount", extraction.total_amount)
        .limit(1)
        .maybeSingle();
      if (!possibleDuplicate.error && possibleDuplicate.data?.id) {
        duplicateOf = String(possibleDuplicate.data.id);
      }
    }

    const updateResponse = await db
      .from("project_receipts")
      .update({
        vendor_name: extraction.vendor_name,
        receipt_number: extraction.receipt_number,
        purchased_at: extraction.purchased_at,
        subtotal: extraction.subtotal,
        tax_amount: extraction.tax_amount,
        total_amount: extraction.total_amount,
        currency_code: extraction.currency_code,
        payment_method: extraction.payment_method,
        extraction_confidence: extraction.confidence,
        extraction_payload: extraction,
        duplicate_of: duplicateOf,
        status: "needs_review",
      })
      .eq("id", receiptId);

    if (updateResponse.error) throw new Error(updateResponse.error.message);

    if (extraction.items.length > 0) {
      const itemResponse = await db.from("project_receipt_items").insert(extraction.items.map((item) => ({
        company_id: workspace.companyId,
        project_id: id,
        receipt_id: receiptId,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
        category: item.category,
        extraction_confidence: item.confidence ?? null,
      })));
      if (itemResponse.error) {
        console.error("Receipt item extraction persistence failed:", itemResponse.error.message);
      }
    }

    const payload = await getReceiptPayload(supabase, workspace.companyId, id);
    return NextResponse.json({ ...payload, createdReceiptId: receiptId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to upload receipt." }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, workspace } = await getProjectContext(id);
    const db = asUntypedDb(supabase);
    const body = await request.json() as ReceiptPatchBody;

    if (!body.receiptId || (body.action !== "approve" && body.action !== "reject")) {
      return NextResponse.json({ error: "Invalid receipt action." }, { status: 400 });
    }

    const receiptResponse = await db
      .from("project_receipts")
      .select("id,project_id,status,duplicate_of")
      .eq("company_id", workspace.companyId)
      .eq("project_id", id)
      .eq("id", body.receiptId)
      .maybeSingle();

    if (receiptResponse.error) throw new Error(receiptResponse.error.message);
    if (!receiptResponse.data) return NextResponse.json({ error: "Receipt not found." }, { status: 404 });

    if (body.action === "reject") {
      const rejectResponse = await db
        .from("project_receipts")
        .update({ status: "rejected", approved_by: null, approved_at: null })
        .eq("id", body.receiptId);
      if (rejectResponse.error) throw new Error(rejectResponse.error.message);
    } else {
      if (receiptResponse.data.duplicate_of && !body.confirmDuplicate) {
        return NextResponse.json({
          error: "This looks like a duplicate receipt. Confirm that it is a separate purchase before approving it.",
          duplicateOf: receiptResponse.data.duplicate_of,
        }, { status: 409 });
      }

      const totalAmount = finiteMoney(body.totalAmount);
      if (totalAmount === null) {
        return NextResponse.json({ error: "Enter a valid receipt total before approving." }, { status: 400 });
      }

      const sanitizedItems = (body.items ?? []).map((item) => ({
        description: String(item.description || "").trim().slice(0, 500),
        quantity: finiteQuantity(item.quantity),
        unit_price: finiteMoney(item.unit_price),
        line_total: finiteMoney(item.line_total) ?? 0,
        category: RECEIPT_CATEGORIES.has(String(item.category).toLowerCase()) ? String(item.category).toLowerCase() : "other",
        cost_code_id: item.cost_code_id || null,
        confidence: normalizeConfidence(item.confidence),
      })).filter((item) => item.description);

      const finalizeResponse = await db.rpc("finalize_project_receipt", {
        p_receipt_id: body.receiptId,
        p_vendor_name: body.vendorName ?? null,
        p_receipt_number: body.receiptNumber ?? null,
        p_purchased_at: normalizeDate(body.purchasedAt) ?? null,
        p_subtotal: finiteMoney(body.subtotal),
        p_tax_amount: finiteMoney(body.taxAmount),
        p_total_amount: totalAmount,
        p_payment_method: body.paymentMethod ?? null,
        p_items: sanitizedItems,
      });
      if (finalizeResponse.error) throw new Error(finalizeResponse.error.message);
    }

    const payload = await getReceiptPayload(supabase, workspace.companyId, id);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update receipt." }, { status: 400 });
  }
}
