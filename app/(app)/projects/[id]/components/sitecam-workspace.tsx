"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Badge, Button, Card, CardContent, EmptyState, ErrorState, SectionHeader, Select, SkeletonLoader } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useI18n, type AppLocale } from "@/lib/i18n/provider";
import type { Database } from "@/types/database.types";

const STORAGE_BUCKET = "project-photos";
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

type SiteCamCategory =
  | "before"
  | "progress"
  | "after"
  | "safety"
  | "damage"
  | "materials"
  | "receipt"
  | "inspection"
  | "change_order"
  | "other";

type ProjectPhotoRow = Database["public"]["Tables"]["project_photos"]["Row"];

type ProjectPhotoRecord = {
  id: string;
  companyId: string;
  projectId: string;
  uploadedBy: string | null;
  storagePath: string;
  originalFilename: string | null;
  mimeType: string | null;
  fileSize: number | null;
  category: SiteCamCategory;
  note: string | null;
  capturedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
};

type PendingUploadFile = {
  id: string;
  file: File;
  previewUrl: string;
};

type UploadStatusKind = "success" | "error" | "info";

type UploadStatus = {
  kind: UploadStatusKind;
  message: string;
} | null;

type ViewMode = "grid" | "timeline";
type DateFilter = "all" | "today" | "last7" | "thisMonth";

type SiteCamWorkspaceProps = {
  companyId: string;
  projectId: string;
  projectName: string;
  userId: string;
  locale: AppLocale;
  profilesById: Record<string, string>;
};

const categoryOrder: SiteCamCategory[] = [
  "before",
  "progress",
  "after",
  "safety",
  "damage",
  "materials",
  "receipt",
  "inspection",
  "change_order",
  "other",
];

const acceptedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);

export function SiteCamWorkspace({
  companyId,
  projectId,
  projectName,
  userId,
  locale,
  profilesById,
}: SiteCamWorkspaceProps) {
  const { t } = useI18n();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [photos, setPhotos] = useState<ProjectPhotoRecord[]>([]);
  const [signedUrlsByPath, setSignedUrlsByPath] = useState<Record<string, string>>({});
  const [brokenPhotoIds, setBrokenPhotoIds] = useState<Record<string, boolean>>({});

  const [categoryFilter, setCategoryFilter] = useState<"all" | SiteCamCategory>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [uploaderFilter, setUploaderFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const [pendingFiles, setPendingFiles] = useState<PendingUploadFile[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<SiteCamCategory>("progress");
  const [uploadNote, setUploadNote] = useState("");
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState({ done: 0, total: 0 });

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [viewerPhotoId, setViewerPhotoId] = useState<string | null>(null);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState<SiteCamCategory>("progress");
  const [editNote, setEditNote] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);

  const [srStatus, setSrStatus] = useState("");

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const modalPrimaryActionRef = useRef<HTMLButtonElement | null>(null);

  const viewerPhoto = photos.find((photo) => photo.id === viewerPhotoId) || null;
  const editingPhoto = photos.find((photo) => photo.id === editingPhotoId) || null;
  const deletingPhoto = photos.find((photo) => photo.id === deletingPhotoId) || null;

  const uploaderOptions = useMemo(() => {
    const uniqueUploaderIds = Array.from(
      new Set(photos.map((photo) => photo.uploadedBy).filter((value): value is string => Boolean(value))),
    );

    return uniqueUploaderIds
      .map((id) => ({ id, label: profilesById[id] || t("projects.sitecamUnknownUploader") }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [photos, profilesById, t]);

  const filteredPhotos = useMemo(() => {
    return photos.filter((photo) => {
      if (categoryFilter !== "all" && photo.category !== categoryFilter) {
        return false;
      }

      if (uploaderFilter !== "all" && photo.uploadedBy !== uploaderFilter) {
        return false;
      }

      if (dateFilter === "all") {
        return true;
      }

      const date = resolvePhotoDate(photo);
      const now = new Date();

      if (dateFilter === "today") {
        return isSameDay(date, now);
      }

      if (dateFilter === "last7") {
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        return date >= sevenDaysAgo;
      }

      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return date >= monthStart;
    });
  }, [categoryFilter, dateFilter, photos, uploaderFilter]);

  const timelineGroups = useMemo(() => {
    const groups = new Map<string, ProjectPhotoRecord[]>();

    filteredPhotos.forEach((photo) => {
      const date = resolvePhotoDate(photo);
      const groupKey = date.toISOString().slice(0, 10);
      const list = groups.get(groupKey) || [];
      list.push(photo);
      groups.set(groupKey, list);
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => (a > b ? -1 : 1))
      .map(([groupKey, groupPhotos]) => ({
        key: groupKey,
        label: formatTimelineGroupLabel(groupKey, localeTag, t),
        photos: groupPhotos.sort((a, b) => (resolvePhotoDate(a) > resolvePhotoDate(b) ? -1 : 1)),
      }));
  }, [filteredPhotos, localeTag, t]);

  useEffect(() => {
    let isSubscribed = true;

    const run = async () => {
      if (!supabase) {
        if (isSubscribed) {
          setErrorMessage(t("projects.errorConnect"));
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      const result = await loadPhotos(supabase, companyId, projectId);

      if (!isSubscribed) {
        return;
      }

      if (result.error) {
        setErrorMessage(result.error);
        setPhotos([]);
        setSignedUrlsByPath({});
        setIsLoading(false);
        return;
      }

      const mappedPhotos = result.photos;
      setPhotos(mappedPhotos);

      const urlsResult = await buildSignedUrlMap(supabase, mappedPhotos.map((photo) => photo.storagePath));

      if (!isSubscribed) {
        return;
      }

      if (urlsResult.error) {
        setErrorMessage(urlsResult.error);
      }

      setSignedUrlsByPath(urlsResult.urls);
      setIsLoading(false);
    };

    void run();

    return () => {
      isSubscribed = false;
    };
  }, [companyId, projectId, supabase, t]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!menuContainerRef.current?.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    };

    if (activeMenuId) {
      window.addEventListener("mousedown", handleOutsideClick);
    }

    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [activeMenuId]);

  useEffect(() => {
    if (!viewerPhoto && !editingPhoto && !deletingPhoto) {
      document.body.style.removeProperty("overflow");
      return;
    }

    document.body.style.overflow = "hidden";
    modalPrimaryActionRef.current?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      setViewerPhotoId(null);
      setEditingPhotoId(null);
      setDeletingPhotoId(null);
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.removeProperty("overflow");
      window.removeEventListener("keydown", handleEscape);
    };
  }, [deletingPhoto, editingPhoto, viewerPhoto]);

  useEffect(() => {
    return () => {
      pendingFiles.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [pendingFiles]);

  function onSelectFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) {
      return;
    }

    const next: PendingUploadFile[] = [];
    const errors: string[] = [];

    files.forEach((file) => {
      const validation = validateImageFile(file, t);

      if (!validation.ok) {
        errors.push(validation.error);
        return;
      }

      next.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      });
    });

    if (errors.length > 0) {
      const message = errors.join(" ");
      setUploadStatus({ kind: "error", message });
      setSrStatus(message);
    } else {
      setUploadStatus(null);
    }

    if (next.length > 0) {
      setPendingFiles((current) => [...current, ...next]);
      setSrStatus(t("projects.sitecamFilesQueued", { count: next.length }));
    }

    event.currentTarget.value = "";
  }

  function removePendingFile(id: string) {
    setPendingFiles((current) => {
      const found = current.find((item) => item.id === id);

      if (found) {
        URL.revokeObjectURL(found.previewUrl);
      }

      return current.filter((item) => item.id !== id);
    });
  }

  async function handleUpload() {
    if (!supabase) {
      setUploadStatus({ kind: "error", message: t("projects.errorConnect") });
      return;
    }

    if (pendingFiles.length === 0) {
      setUploadStatus({ kind: "error", message: t("projects.sitecamValidationNoFiles") });
      return;
    }

    setIsUploading(true);
    setUploadStatus({ kind: "info", message: t("projects.sitecamUploadInProgress") });
    setUploadCount({ done: 0, total: pendingFiles.length });

    const { error: bucketCheckError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(`${companyId}/${projectId}`, { limit: 1 });

    if (bucketCheckError) {
      setIsUploading(false);
      setUploadStatus({
        kind: "error",
        message: `${t("projects.sitecamUploadSummary", { success: 0, failed: pendingFiles.length })} ${bucketCheckError.message}`,
      });
      setSrStatus(bucketCheckError.message);
      return;
    }

    let successCount = 0;
    let failureCount = 0;
    const failureDetails: string[] = [];

    for (let index = 0; index < pendingFiles.length; index += 1) {
      const item = pendingFiles[index];
      const photoId = crypto.randomUUID();
      const storagePath = `${companyId}/${projectId}/${photoId}/${sanitizeFilename(item.file.name)}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, item.file, {
          upsert: false,
          contentType: item.file.type || undefined,
        });

      if (uploadError) {
        failureDetails.push(`Storage: ${uploadError.message}`);
        failureCount += 1;
        setUploadCount({ done: index + 1, total: pendingFiles.length });
        continue;
      }

      const { error: insertError } = await supabase
        .from("project_photos")
        .insert({
          id: photoId,
          company_id: companyId,
          project_id: projectId,
          uploaded_by: userId,
          storage_path: storagePath,
          original_filename: item.file.name,
          mime_type: item.file.type || null,
          file_size: item.file.size,
          category: selectedCategory,
          note: uploadNote.trim() || null,
          captured_at: new Date().toISOString(),
        });

      if (insertError) {
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
        failureDetails.push(`Database: ${insertError.message}`);
        failureCount += 1;
        setUploadCount({ done: index + 1, total: pendingFiles.length });
        continue;
      }

      successCount += 1;
      setUploadCount({ done: index + 1, total: pendingFiles.length });
    }

    setIsUploading(false);

    const statusMessage = t("projects.sitecamUploadSummary", {
      success: successCount,
      failed: failureCount,
    });

    const detailedStatusMessage = failureDetails.length > 0
      ? `${statusMessage} ${failureDetails[0]}`
      : statusMessage;

    setUploadStatus({
      kind: failureCount > 0 ? "error" : "success",
      message: detailedStatusMessage,
    });
    setSrStatus(detailedStatusMessage);

    if (successCount > 0) {
      pendingFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setPendingFiles([]);
      setUploadNote("");
      await refreshPhotos();
    }
  }

  async function refreshPhotos() {
    if (!supabase) {
      return;
    }

    const result = await loadPhotos(supabase, companyId, projectId);

    if (result.error) {
      setErrorMessage(result.error);
      return;
    }

    setPhotos(result.photos);

    const urlsResult = await buildSignedUrlMap(supabase, result.photos.map((photo) => photo.storagePath));

    if (urlsResult.error) {
      setErrorMessage(urlsResult.error);
    } else {
      setErrorMessage(null);
    }

    setSignedUrlsByPath(urlsResult.urls);
  }

  function openEditModal(photoId: string) {
    const target = photos.find((photo) => photo.id === photoId);

    if (!target) {
      return;
    }

    setEditCategory(target.category);
    setEditNote(target.note || "");
    setEditingPhotoId(photoId);
    setActiveMenuId(null);
  }

  async function savePhotoMetadata() {
    if (!supabase || !editingPhoto) {
      return;
    }

    setIsSavingEdit(true);

    const { error } = await supabase
      .from("project_photos")
      .update({
        category: editCategory,
        note: editNote.trim() || null,
      })
      .eq("id", editingPhoto.id)
      .eq("company_id", companyId)
      .eq("project_id", projectId);

    setIsSavingEdit(false);

    if (error) {
      setUploadStatus({ kind: "error", message: t("projects.sitecamUpdateFailed", { message: error.message }) });
      return;
    }

    setEditingPhotoId(null);
    const successMessage = t("projects.sitecamUpdateSuccess");
    setUploadStatus({ kind: "success", message: successMessage });
    setSrStatus(successMessage);
    await refreshPhotos();
  }

  async function deletePhoto() {
    if (!supabase || !deletingPhoto) {
      return;
    }

    setIsDeletingPhoto(true);

    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([deletingPhoto.storagePath]);

    if (storageError) {
      setIsDeletingPhoto(false);
      setUploadStatus({ kind: "error", message: t("projects.sitecamDeleteStorageFailed", { message: storageError.message }) });
      return;
    }

    const { error: deleteError } = await supabase
      .from("project_photos")
      .delete()
      .eq("id", deletingPhoto.id)
      .eq("company_id", companyId)
      .eq("project_id", projectId);

    setIsDeletingPhoto(false);

    if (deleteError) {
      setUploadStatus({ kind: "error", message: t("projects.sitecamDeleteFailed", { message: deleteError.message }) });
      return;
    }

    setViewerPhotoId((current) => (current === deletingPhoto.id ? null : current));
    setDeletingPhotoId(null);
    const successMessage = t("projects.sitecamDeleteSuccess");
    setUploadStatus({ kind: "success", message: successMessage });
    setSrStatus(successMessage);
    await refreshPhotos();
  }

  async function downloadPhoto(photo: ProjectPhotoRecord) {
    if (!supabase) {
      return;
    }

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(photo.storagePath, 60);

    if (error || !data?.signedUrl) {
      setUploadStatus({ kind: "error", message: t("projects.sitecamDownloadFailed") });
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = data.signedUrl;
    anchor.download = photo.originalFilename || "sitecam-photo";
    anchor.rel = "noopener noreferrer";
    anchor.target = "_blank";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }

  function clearFilters() {
    setCategoryFilter("all");
    setDateFilter("all");
    setUploaderFilter("all");
  }

  function markImageAsBroken(photoId: string) {
    setBrokenPhotoIds((current) => ({
      ...current,
      [photoId]: true,
    }));
  }

  const hasPermissionError = isPermissionError(errorMessage || "");

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-6 p-6">
          <SectionHeader
            title={t("projects.sitecamTitle")}
            description={t("projects.sitecamDescription")}
            action={
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  fullWidth
                  onClick={() => cameraInputRef.current?.click()}
                >
                  {t("projects.sitecamTakePhoto")}
                </Button>
                <Button
                  type="button"
                  fullWidth
                  onClick={() => uploadInputRef.current?.click()}
                >
                  {t("projects.sitecamUploadPhotos")}
                </Button>
              </div>
            }
          />

          <input
            ref={uploadInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/*"
            multiple
            className="sr-only"
            aria-label={t("projects.sitecamUploadPhotos")}
            onChange={onSelectFiles}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            aria-label={t("projects.sitecamTakePhoto")}
            onChange={onSelectFiles}
          />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <InfoChip label={t("projects.sitecamPhotoCount")} value={String(photos.length)} />

            <Select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value as "all" | SiteCamCategory)}
              aria-label={t("projects.sitecamFilterCategory")}
            >
              <option value="all">{t("projects.sitecamAllCategories")}</option>
              {categoryOrder.map((category) => (
                <option key={category} value={category}>
                  {t(getCategoryLabelKey(category))}
                </option>
              ))}
            </Select>

            <Select
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value as DateFilter)}
              aria-label={t("projects.sitecamFilterDate")}
            >
              <option value="all">{t("projects.sitecamDateAll")}</option>
              <option value="today">{t("projects.sitecamDateToday")}</option>
              <option value="last7">{t("projects.sitecamDateLast7")}</option>
              <option value="thisMonth">{t("projects.sitecamDateThisMonth")}</option>
            </Select>

            <Select
              value={uploaderFilter}
              onChange={(event) => setUploaderFilter(event.target.value)}
              aria-label={t("projects.sitecamFilterUploader")}
            >
              <option value="all">{t("projects.sitecamAllUploaders")}</option>
              {uploaderOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>

            <div className="xl:col-span-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`rounded-[var(--radius-md)] border px-3 py-2.5 text-sm font-semibold ${
                  viewMode === "grid"
                    ? "border-[var(--color-brand-600)] bg-[var(--color-brand-50)] text-[var(--color-brand-700)]"
                    : "border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
                }`}
                aria-pressed={viewMode === "grid"}
                aria-label={t("projects.sitecamViewGrid")}
              >
                {t("projects.sitecamViewGrid")}
              </button>
              <button
                type="button"
                onClick={() => setViewMode("timeline")}
                className={`rounded-[var(--radius-md)] border px-3 py-2.5 text-sm font-semibold ${
                  viewMode === "timeline"
                    ? "border-[var(--color-brand-600)] bg-[var(--color-brand-50)] text-[var(--color-brand-700)]"
                    : "border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
                }`}
                aria-pressed={viewMode === "timeline"}
                aria-label={t("projects.sitecamViewTimeline")}
              >
                {t("projects.sitecamViewTimeline")}
              </button>
              <Button type="button" variant="ghost" onClick={clearFilters}>
                {t("projects.sitecamClearFilters")}
              </Button>
            </div>
          </div>

          <div aria-live="polite" className="sr-only">{srStatus}</div>

          {uploadStatus ? (
            <StatusBanner kind={uploadStatus.kind} message={uploadStatus.message} />
          ) : null}

          {pendingFiles.length > 0 ? (
            <UploadQueuePanel
              pendingFiles={pendingFiles}
              selectedCategory={selectedCategory}
              uploadNote={uploadNote}
              isUploading={isUploading}
              uploadCount={uploadCount}
              onCategoryChange={(value) => setSelectedCategory(value as SiteCamCategory)}
              onNoteChange={setUploadNote}
              onRemove={removePendingFile}
              onUpload={handleUpload}
              t={t}
            />
          ) : null}
        </CardContent>
      </Card>

      {isLoading ? (
        <SiteCamLoadingState />
      ) : errorMessage ? (
        <ErrorState
          title={hasPermissionError ? t("projects.sitecamPermissionTitle") : t("projects.sitecamLoadErrorTitle")}
          description={errorMessage}
          compact
        />
      ) : filteredPhotos.length === 0 ? (
        <EmptyState
          compact
          icon="SC"
          title={t("projects.sitecamEmptyTitle")}
          description={t("projects.sitecamEmptyDescription")}
        />
      ) : viewMode === "grid" ? (
        <div ref={menuContainerRef} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredPhotos.map((photo) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              imageUrl={signedUrlsByPath[photo.storagePath] || null}
              isBrokenImage={Boolean(brokenPhotoIds[photo.id])}
              localeTag={localeTag}
              uploaderName={photo.uploadedBy ? profilesById[photo.uploadedBy] || t("projects.sitecamUnknownUploader") : t("projects.notAssigned")}
              projectName={projectName}
              activeMenuId={activeMenuId}
              onMenuToggle={setActiveMenuId}
              onView={() => {
                setViewerPhotoId(photo.id);
                setActiveMenuId(null);
              }}
              onEdit={() => {
                void openEditModal(photo.id);
              }}
              onDownload={() => {
                void downloadPhoto(photo);
                setActiveMenuId(null);
              }}
              onDelete={() => {
                setDeletingPhotoId(photo.id);
                setActiveMenuId(null);
              }}
              onImageError={() => markImageAsBroken(photo.id)}
              t={t}
            />
          ))}
        </div>
      ) : (
        <div ref={menuContainerRef} className="space-y-6">
          {timelineGroups.map((group) => (
            <section key={group.key} className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                {group.label}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {group.photos.map((photo) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    imageUrl={signedUrlsByPath[photo.storagePath] || null}
                    isBrokenImage={Boolean(brokenPhotoIds[photo.id])}
                    localeTag={localeTag}
                    uploaderName={photo.uploadedBy ? profilesById[photo.uploadedBy] || t("projects.sitecamUnknownUploader") : t("projects.notAssigned")}
                    projectName={projectName}
                    activeMenuId={activeMenuId}
                    onMenuToggle={setActiveMenuId}
                    onView={() => {
                      setViewerPhotoId(photo.id);
                      setActiveMenuId(null);
                    }}
                    onEdit={() => {
                      void openEditModal(photo.id);
                    }}
                    onDownload={() => {
                      void downloadPhoto(photo);
                      setActiveMenuId(null);
                    }}
                    onDelete={() => {
                      setDeletingPhotoId(photo.id);
                      setActiveMenuId(null);
                    }}
                    onImageError={() => markImageAsBroken(photo.id)}
                    t={t}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {viewerPhoto ? (
        <DialogOverlay closeLabel={t("projects.close")} onClose={() => setViewerPhotoId(null)}>
          <article
            role="dialog"
            aria-modal="true"
            aria-label={t("projects.sitecamViewerTitle")}
            className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-[var(--radius-xl)] bg-white shadow-[var(--shadow-large)]"
          >
            <div className="grid gap-0 lg:grid-cols-[1.5fr_1fr]">
              <div className="min-h-80 bg-[var(--color-surface-subtle)]">
                {signedUrlsByPath[viewerPhoto.storagePath] && !brokenPhotoIds[viewerPhoto.id] ? (
                  <img
                    src={signedUrlsByPath[viewerPhoto.storagePath]}
                    alt={viewerPhoto.note || t("projects.sitecamImageAlt", { category: t(getCategoryLabelKey(viewerPhoto.category)) })}
                    className="h-full w-full object-contain"
                    onError={() => markImageAsBroken(viewerPhoto.id)}
                  />
                ) : (
                  <div className="flex h-full min-h-80 items-center justify-center text-sm font-semibold text-[var(--color-text-muted)]">
                    {t("projects.sitecamImageUnavailable")}
                  </div>
                )}
              </div>

              <div className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("projects.sitecamViewerTitle")}</h2>
                  <button
                    ref={modalPrimaryActionRef}
                    type="button"
                    onClick={() => setViewerPhotoId(null)}
                    className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-1 text-sm font-semibold text-[var(--color-text-secondary)]"
                  >
                    {t("projects.close")}
                  </button>
                </div>

                <MetadataLine label={t("projects.sitecamMetaCategory")} value={t(getCategoryLabelKey(viewerPhoto.category))} />
                <MetadataLine label={t("projects.sitecamMetaProject")} value={projectName} />
                <MetadataLine
                  label={t("projects.sitecamMetaUploaded")}
                  value={formatDateTime(resolvePhotoDate(viewerPhoto), localeTag)}
                />
                <MetadataLine
                  label={t("projects.sitecamMetaCaptured")}
                  value={viewerPhoto.capturedAt ? formatDateTime(new Date(viewerPhoto.capturedAt), localeTag) : t("projects.notProvided")}
                />
                <MetadataLine
                  label={t("projects.sitecamMetaUploader")}
                  value={viewerPhoto.uploadedBy ? profilesById[viewerPhoto.uploadedBy] || t("projects.sitecamUnknownUploader") : t("projects.notAssigned")}
                />
                <MetadataLine label={t("projects.sitecamMetaNote")} value={viewerPhoto.note || t("projects.sitecamNoNote")} />
                <MetadataLine label={t("projects.sitecamMetaFilename")} value={viewerPhoto.originalFilename || t("projects.notProvided")} />
                <MetadataLine label={t("projects.sitecamMetaFileSize")} value={formatFileSize(viewerPhoto.fileSize, t("projects.notProvided"))} />

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => void downloadPhoto(viewerPhoto)}>
                    {t("projects.sitecamActionDownload")}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void openEditModal(viewerPhoto.id)}>
                    {t("projects.sitecamActionEdit")}
                  </Button>
                  <Button type="button" variant="danger" onClick={() => setDeletingPhotoId(viewerPhoto.id)}>
                    {t("projects.sitecamActionDelete")}
                  </Button>
                </div>
              </div>
            </div>
          </article>
        </DialogOverlay>
      ) : null}

      {editingPhoto ? (
        <DialogOverlay closeLabel={t("projects.close")} onClose={() => setEditingPhotoId(null)}>
          <article
            role="dialog"
            aria-modal="true"
            aria-label={t("projects.sitecamEditTitle")}
            className="w-full max-w-xl rounded-[var(--radius-xl)] bg-white p-6 shadow-[var(--shadow-large)]"
          >
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("projects.sitecamEditTitle")}</h2>

            <div className="mt-4 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[var(--color-text-secondary)]">{t("projects.sitecamMetaCategory")}</span>
                <Select value={editCategory} onChange={(event) => setEditCategory(event.target.value as SiteCamCategory)}>
                  {categoryOrder.map((category) => (
                    <option key={category} value={category}>
                      {t(getCategoryLabelKey(category))}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[var(--color-text-secondary)]">{t("projects.sitecamMetaNote")}</span>
                <textarea
                  value={editNote}
                  onChange={(event) => setEditNote(event.target.value)}
                  maxLength={500}
                  className="min-h-24 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingPhotoId(null)}>
                {t("projects.cancel")}
              </Button>
              <Button type="button" disabled={isSavingEdit} onClick={() => void savePhotoMetadata()}>
                {isSavingEdit ? t("projects.sitecamSaving") : t("projects.sitecamSave")}
              </Button>
            </div>
          </article>
        </DialogOverlay>
      ) : null}

      {deletingPhoto ? (
        <DialogOverlay closeLabel={t("projects.close")} onClose={() => setDeletingPhotoId(null)}>
          <article
            role="dialog"
            aria-modal="true"
            aria-label={t("projects.sitecamDeleteTitle")}
            className="w-full max-w-lg rounded-[var(--radius-xl)] bg-white p-6 shadow-[var(--shadow-large)]"
          >
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("projects.sitecamDeleteTitle")}</h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{t("projects.sitecamDeleteDescription")}</p>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDeletingPhotoId(null)}>
                {t("projects.cancel")}
              </Button>
              <Button type="button" variant="danger" disabled={isDeletingPhoto} onClick={() => void deletePhoto()}>
                {isDeletingPhoto ? t("projects.sitecamDeleting") : t("projects.sitecamConfirmDelete")}
              </Button>
            </div>
          </article>
        </DialogOverlay>
      ) : null}
    </div>
  );
}

function UploadQueuePanel({
  pendingFiles,
  selectedCategory,
  uploadNote,
  isUploading,
  uploadCount,
  onCategoryChange,
  onNoteChange,
  onRemove,
  onUpload,
  t,
}: {
  pendingFiles: PendingUploadFile[];
  selectedCategory: SiteCamCategory;
  uploadNote: string;
  isUploading: boolean;
  uploadCount: { done: number; total: number };
  onCategoryChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onRemove: (id: string) => void;
  onUpload: () => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t("projects.sitecamQueuedFiles", { count: pendingFiles.length })}</p>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pendingFiles.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white">
                <img src={item.previewUrl} alt={item.file.name} className="h-32 w-full object-cover" />
                <div className="space-y-1 p-3">
                  <p className="line-clamp-1 text-xs font-semibold text-[var(--color-text-primary)]">{item.file.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{formatFileSize(item.file.size, t("projects.notProvided"))}</p>
                  <button
                    type="button"
                    className="rounded-[var(--radius-sm)] px-2 py-1 text-xs font-semibold text-[var(--color-danger-700)] hover:bg-[var(--color-danger-50)]"
                    onClick={() => onRemove(item.id)}
                  >
                    {t("projects.sitecamRemoveFile")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white p-4">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[var(--color-text-secondary)]">{t("projects.sitecamMetaCategory")}</span>
            <Select value={selectedCategory} onChange={(event) => onCategoryChange(event.target.value)}>
              {categoryOrder.map((category) => (
                <option key={category} value={category}>
                  {t(getCategoryLabelKey(category))}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[var(--color-text-secondary)]">{t("projects.sitecamMetaNote")}</span>
            <textarea
              value={uploadNote}
              onChange={(event) => onNoteChange(event.target.value)}
              maxLength={500}
              className="min-h-24 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              placeholder={t("projects.sitecamNotePlaceholder")}
            />
          </label>

          {isUploading ? (
            <p className="text-xs font-semibold text-[var(--color-brand-700)]">
              {t("projects.sitecamUploadProgress", { done: uploadCount.done, total: uploadCount.total })}
            </p>
          ) : null}

          <Button type="button" fullWidth disabled={isUploading || pendingFiles.length === 0} onClick={() => void onUpload()}>
            {isUploading ? t("projects.sitecamUploadInProgress") : t("projects.sitecamStartUpload")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PhotoCard({
  photo,
  imageUrl,
  isBrokenImage,
  uploaderName,
  localeTag,
  projectName,
  activeMenuId,
  onMenuToggle,
  onView,
  onEdit,
  onDownload,
  onDelete,
  onImageError,
  t,
}: {
  photo: ProjectPhotoRecord;
  imageUrl: string | null;
  isBrokenImage: boolean;
  uploaderName: string;
  localeTag: string;
  projectName: string;
  activeMenuId: string | null;
  onMenuToggle: (id: string | null) => void;
  onView: () => void;
  onEdit: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onImageError: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <article className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white">
      <button type="button" onClick={onView} className="block w-full text-left" aria-label={t("projects.sitecamActionView")}>
        <div className="h-40 bg-[var(--color-surface-subtle)] sm:h-44">
          {imageUrl && !isBrokenImage ? (
            <img
              src={imageUrl}
              alt={photo.note || t("projects.sitecamImageAlt", { category: t(getCategoryLabelKey(photo.category)) })}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={onImageError}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm font-semibold text-[var(--color-text-muted)]">
              {t("projects.sitecamImageUnavailable")}
            </div>
          )}
        </div>
      </button>

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <Badge tone="info">{t(getCategoryLabelKey(photo.category))}</Badge>

          <div className="relative">
            <button
              type="button"
              aria-label={t("projects.sitecamMoreActions")}
              aria-haspopup="menu"
              aria-expanded={activeMenuId === photo.id}
              onClick={() => onMenuToggle(activeMenuId === photo.id ? null : photo.id)}
              className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-2 py-1 text-xs font-semibold text-[var(--color-text-secondary)]"
            >
              {t("projects.sitecamMore")}
            </button>

            {activeMenuId === photo.id ? (
              <div role="menu" className="absolute right-0 z-20 mt-2 min-w-40 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white p-1 shadow-[var(--shadow-md)]">
                <ActionMenuButton label={t("projects.sitecamActionView")} onClick={onView} />
                <ActionMenuButton label={t("projects.sitecamActionEdit")} onClick={onEdit} />
                <ActionMenuButton label={t("projects.sitecamActionDownload")} onClick={onDownload} />
                <ActionMenuButton label={t("projects.sitecamActionDelete")} onClick={onDelete} danger />
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-1 text-xs text-[var(--color-text-muted)]">
          <p>{formatDateTime(resolvePhotoDate(photo), localeTag)}</p>
          <p>{t("projects.sitecamMetaUploader")}: {uploaderName}</p>
          <p>{t("projects.sitecamMetaProject")}: {projectName}</p>
          <p className="line-clamp-2 text-[var(--color-text-secondary)]">{photo.note || t("projects.sitecamNoNote")}</p>
        </div>
      </div>
    </article>
  );
}

function ActionMenuButton({ label, onClick, danger = false }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`block w-full rounded-[var(--radius-sm)] px-3 py-2.5 text-left text-sm ${
        danger
          ? "text-[var(--color-danger-700)] hover:bg-[var(--color-danger-50)]"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]"
      }`}
    >
      {label}
    </button>
  );
}

function SiteCamLoadingState() {
  return (
    <div className="space-y-3">
      <SkeletonLoader className="h-44 w-full" />
      <SkeletonLoader className="h-44 w-full" />
      <SkeletonLoader className="h-44 w-full" />
    </div>
  );
}

function StatusBanner({ kind, message }: { kind: UploadStatusKind; message: string }) {
  const styles = kind === "success"
    ? "border-[var(--color-success-200)] bg-[var(--color-success-50)] text-[var(--color-success-700)]"
    : kind === "error"
      ? "border-[var(--color-danger-200)] bg-[var(--color-danger-50)] text-[var(--color-danger-700)]"
      : "border-[var(--color-info-200)] bg-[var(--color-info-50)] text-[var(--color-info-700)]";

  return <div className={`rounded-[var(--radius-md)] border px-3 py-2 text-sm font-medium ${styles}`}>{message}</div>;
}

function MetadataLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-sm text-[var(--color-text-primary)] break-words">{value}</p>
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

function DialogOverlay({
  children,
  closeLabel,
  onClose,
}: {
  children: ReactNode;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/50"
      />
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}

async function loadPhotos(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  projectId: string,
): Promise<{ photos: ProjectPhotoRecord[]; error: string | null }> {
  if (!supabase) {
    return { photos: [], error: null };
  }

  const { data, error } = await supabase
    .from("project_photos")
    .select("id, company_id, project_id, uploaded_by, storage_path, original_filename, mime_type, file_size, category, note, captured_at, latitude, longitude, created_at, updated_at")
    .eq("company_id", companyId)
    .eq("project_id", projectId)
    .order("captured_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return { photos: [], error: error.message };
  }

  const photos = ((data || []) as ProjectPhotoRow[]).map((row) => ({
    id: row.id,
    companyId: row.company_id,
    projectId: row.project_id,
    uploadedBy: row.uploaded_by,
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    category: row.category as SiteCamCategory,
    note: row.note,
    capturedAt: row.captured_at,
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return { photos, error: null };
}

async function buildSignedUrlMap(
  supabase: ReturnType<typeof createClient>,
  storagePaths: string[],
): Promise<{ urls: Record<string, string>; error: string | null }> {
  if (!supabase || storagePaths.length === 0) {
    return { urls: {}, error: null };
  }

  const { data, error } = await supabase
    .storage
    .from(STORAGE_BUCKET)
    .createSignedUrls(storagePaths, SIGNED_URL_EXPIRY_SECONDS);

  if (error) {
    return { urls: {}, error: error.message };
  }

  const urls = (data || []).reduce<Record<string, string>>((acc, item, index) => {
    const path = storagePaths[index];

    if (path && item?.signedUrl) {
      acc[path] = item.signedUrl;
    }

    return acc;
  }, {});

  return { urls, error: null };
}

function validateImageFile(file: File, t: (key: string, params?: Record<string, string | number>) => string) {
  const normalizedName = file.name.toLowerCase();
  const isHeicName = normalizedName.endsWith(".heic");
  const hasAllowedMimeType = acceptedMimeTypes.has(file.type);

  if (!hasAllowedMimeType && !isHeicName) {
    return {
      ok: false as const,
      error: t("projects.sitecamValidationType", { filename: file.name }),
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false as const,
      error: t("projects.sitecamValidationSize", { filename: file.name, max: "10MB" }),
    };
  }

  return { ok: true as const };
}

function sanitizeFilename(filename: string) {
  const cleaned = filename
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/-+/g, "-");

  if (!cleaned) {
    return "photo";
  }

  return cleaned.slice(0, 120);
}

function getCategoryLabelKey(category: SiteCamCategory) {
  const map: Record<SiteCamCategory, string> = {
    before: "projects.sitecamCategoryBefore",
    progress: "projects.sitecamCategoryProgress",
    after: "projects.sitecamCategoryAfter",
    safety: "projects.sitecamCategorySafety",
    damage: "projects.sitecamCategoryDamage",
    materials: "projects.sitecamCategoryMaterials",
    receipt: "projects.sitecamCategoryReceipt",
    inspection: "projects.sitecamCategoryInspection",
    change_order: "projects.sitecamCategoryChangeOrder",
    other: "projects.sitecamCategoryOther",
  };

  return map[category];
}

function resolvePhotoDate(photo: ProjectPhotoRecord) {
  const raw = photo.capturedAt || photo.createdAt;
  const resolved = new Date(raw);
  return Number.isNaN(resolved.getTime()) ? new Date(photo.createdAt) : resolved;
}

function formatDateTime(date: Date, localeTag: string) {
  return new Intl.DateTimeFormat(localeTag, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatTimelineGroupLabel(
  groupKey: string,
  localeTag: string,
  t: (key: string) => string,
) {
  const date = new Date(`${groupKey}T00:00:00`);
  const now = new Date();

  if (isSameDay(date, now)) {
    return t("projects.sitecamTimelineToday");
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(date, yesterday)) {
    return t("projects.sitecamTimelineYesterday");
  }

  return new Intl.DateTimeFormat(localeTag, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatFileSize(fileSize: number | null, fallback: string) {
  if (typeof fileSize !== "number" || Number.isNaN(fileSize)) {
    return fallback;
  }

  if (fileSize < 1024) {
    return `${fileSize} B`;
  }

  if (fileSize < 1024 * 1024) {
    return `${(fileSize / 1024).toFixed(1)} KB`;
  }

  return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
}

function isPermissionError(message: string) {
  const normalized = message.toLowerCase();

  return normalized.includes("permission")
    || normalized.includes("not authorized")
    || normalized.includes("forbidden")
    || normalized.includes("row-level security")
    || normalized.includes("rls");
}
