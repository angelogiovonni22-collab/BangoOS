import type { MobileDailyReportDraft } from "./mobile-field-operations-types";

export function appendReportPhoto(draft: MobileDailyReportDraft, photo: { id: string; fileName: string }): MobileDailyReportDraft {
  return { ...draft, photos: [...draft.photos, photo.fileName], photoIds: [...draft.photos.map((_, index) => draft.photoIds?.[index] ?? null), photo.id] };
}
export function removeReportPhoto(draft: MobileDailyReportDraft, index: number): MobileDailyReportDraft {
  return { ...draft, photos: draft.photos.filter((_, i) => i !== index), photoIds: draft.photos.map((_, i) => draft.photoIds?.[i] ?? null).filter((_, i) => i !== index) };
}
export function reportPhotoAttachments(draft: MobileDailyReportDraft, uploadedAt: string) {
  return draft.photos.map((fileName, index) => ({
    id: `photo-${index}-${Date.parse(uploadedAt)}`,
    fileName, caption: "Field photo", category: "progress" as const, uploadedAt,
    ...(draft.photoIds?.[index] ? { projectPhotoId: draft.photoIds[index]! } : {}),
  }));
}
