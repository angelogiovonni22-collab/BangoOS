import type { SupabaseClient } from "@supabase/supabase-js";

export const RECORD_ATTACHMENTS_BUCKET = "record-attachments";
export const MAX_RECORD_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const RECORD_ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;

export type RecordAttachmentEntity = "customer" | "estimate" | "invoice" | "project";

export type QueuedRecordAttachment = {
  id: string;
  file: File;
  previewUrl: string;
  caption: string;
  status: "queued" | "uploading" | "uploaded" | "error";
  progress: number;
  error?: string;
};

function safeFilename(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "photo";
}

export function validateRecordAttachment(file: File): string | null {
  if (!RECORD_ATTACHMENT_TYPES.includes(file.type as (typeof RECORD_ATTACHMENT_TYPES)[number])) {
    return "Use a JPEG, PNG, WebP, HEIC, or HEIF photo.";
  }
  if (file.size > MAX_RECORD_ATTACHMENT_BYTES) {
    return "Photos must be 10 MB or smaller.";
  }
  return null;
}

export async function uploadRecordAttachment(params: {
  supabase: SupabaseClient;
  companyId: string;
  userId: string;
  entityType: RecordAttachmentEntity;
  entityId: string;
  attachment: QueuedRecordAttachment;
  sortOrder: number;
}) {
  const storagePath = `${params.companyId}/${params.entityType}/${params.entityId}/${crypto.randomUUID()}-${safeFilename(params.attachment.file.name)}`;
  const { error: uploadError } = await params.supabase.storage
    .from(RECORD_ATTACHMENTS_BUCKET)
    .upload(storagePath, params.attachment.file, { contentType: params.attachment.file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { error: metadataError } = await params.supabase.from("record_attachments" as never).insert({
    company_id: params.companyId,
    entity_type: params.entityType,
    entity_id: params.entityId,
    storage_path: storagePath,
    uploaded_by: params.userId,
    caption: params.attachment.caption.trim() || null,
    sort_order: params.sortOrder,
    mime_type: params.attachment.file.type,
    file_size_bytes: params.attachment.file.size,
    original_filename: params.attachment.file.name,
  } as never);
  if (metadataError) {
    await params.supabase.storage.from(RECORD_ATTACHMENTS_BUCKET).remove([storagePath]);
    throw metadataError;
  }
}
