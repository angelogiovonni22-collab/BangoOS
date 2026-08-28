import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "subcontractor-compliance";
const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_REQUIREMENTS = new Set(["w9", "coi", "workers_comp", "licenses"]);
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

type TradePartnerMembership = {
  company_id: string;
  vendor_id: string | null;
};

function safeFilename(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
}

async function getPartnerContext() {
  const supabase = await createClient();
  if (!supabase) throw new Error("B.O.S. authentication is unavailable.");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to continue.");
  const admin = createAdminClient();
  const { data: membershipRow, error } = await admin.from("company_memberships" as never).select("company_id,vendor_id").eq("user_id", user.id).eq("status", "active").eq("role", "subcontractor").not("vendor_id", "is", null).order("is_primary", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  const membership = membershipRow as unknown as TradePartnerMembership | null;
  if (!membership?.vendor_id) throw new Error("This Trade Partner login is not linked to a company profile yet.");
  return { admin, user, companyId: membership.company_id, vendorId: membership.vendor_id };
}

export async function POST(request: Request) {
  let uploadedPath: string | null = null;
  try {
    const { admin, user, companyId, vendorId } = await getPartnerContext();
    const form = await request.formData();
    const file = form.get("file");
    const requirementType = String(form.get("requirementType") || "");
    const expiresAtRaw = String(form.get("expiresAt") || "").trim();

    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a document to upload." }, { status: 400 });
    if (!ALLOWED_REQUIREMENTS.has(requirementType)) return NextResponse.json({ error: "Invalid document type." }, { status: 400 });
    if (!ALLOWED_MIME_TYPES.has(file.type)) return NextResponse.json({ error: "Upload a PDF, image, DOC, or DOCX file." }, { status: 400 });
    if (file.size < 1 || file.size > MAX_BYTES) return NextResponse.json({ error: "Documents must be 20 MB or smaller." }, { status: 400 });
    if (expiresAtRaw && Number.isNaN(Date.parse(expiresAtRaw))) return NextResponse.json({ error: "Expiration date is invalid." }, { status: 400 });

    uploadedPath = `${companyId}/${vendorId}/onboarding/${requirementType}/${crypto.randomUUID()}-${safeFilename(file.name)}`;
    const bytes = await file.arrayBuffer();
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(uploadedPath, bytes, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(uploadError.message || "Unable to upload document.");

    await admin.from("trade_partner_onboarding_documents" as never).update({ status: "superseded", updated_at: new Date().toISOString() } as never).eq("company_id", companyId).eq("vendor_id", vendorId).eq("requirement_type", requirementType).eq("status", "active");

    const { data: document, error: metadataError } = await admin.from("trade_partner_onboarding_documents" as never).insert({
      company_id: companyId,
      vendor_id: vendorId,
      requirement_type: requirementType,
      storage_path: uploadedPath,
      original_filename: file.name,
      mime_type: file.type,
      file_size_bytes: file.size,
      expires_at: expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null,
      status: "active",
      uploaded_by: user.id,
    } as never).select("id,requirement_type,original_filename,file_size_bytes,expires_at,storage_path,created_at").single();
    if (metadataError || !document) throw new Error(metadataError?.message || "Unable to record document.");

    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(String((document as Record<string, unknown>).storage_path), 60 * 10);
    return NextResponse.json({
      uploaded: true,
      document: {
        id: (document as Record<string, unknown>).id,
        requirementType: (document as Record<string, unknown>).requirement_type,
        originalFilename: (document as Record<string, unknown>).original_filename,
        fileSizeBytes: (document as Record<string, unknown>).file_size_bytes,
        expiresAt: (document as Record<string, unknown>).expires_at,
        createdAt: (document as Record<string, unknown>).created_at,
        viewUrl: signed?.signedUrl || null,
      },
    });
  } catch (error) {
    if (uploadedPath) {
      try { await createAdminClient().storage.from(BUCKET).remove([uploadedPath]); } catch { /* best effort cleanup */ }
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to upload Trade Partner document." }, { status: 400 });
  }
}
