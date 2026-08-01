"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ChevronLeft, ChevronRight } from "lucide-react";
import { WorkspaceEnvironment } from "@/components/bangoflow";
import { AnimatedProgress, FadeIn, useFocusTrap } from "@/components/motion";
import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, ErrorState } from "@/components/ui";
import { collectNewEntityIds, hasAnimatedEntries } from "@/lib/motion/replay-helpers";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";

const STORAGE_BUCKET = "project-photos";
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

type ProjectPhotoRow = Database["public"]["Tables"]["project_photos"]["Row"];

type ProjectPhotoRecord = {
  id: string;
  projectId: string;
  companyId: string;
  uploadedBy: string | null;
  storagePath: string;
  note: string | null;
  category: string;
  capturedAt: string | null;
  createdAt: string;
  originalFilename: string | null;
  mimeType: string | null;
  fileSize: number | null;
};

type UploadItem = {
  id: string;
  file: File;
};

type UploadStatus = {
  kind: "success" | "error" | "info";
  message: string;
} | null;

type ProjectWorkSiteCamPanelProps = {
  companyId: string;
  projectId: string;
  projectName: string;
  userId: string;
  selectedPhaseId: string | null;
  selectedPhaseName: string | null;
  selectedTaskId: string | null;
  selectedTaskTitle: string | null;
  profiles: Record<string, string>;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ProjectWorkSiteCamPanel({
  companyId,
  projectId,
  projectName,
  userId,
  selectedPhaseId,
  selectedPhaseName,
  selectedTaskId,
  selectedTaskTitle,
  profiles,
  t,
}: ProjectWorkSiteCamPanelProps) {
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [photos, setPhotos] = useState<ProjectPhotoRecord[]>([]);
  const [signedUrlByPath, setSignedUrlByPath] = useState<Record<string, string>>({});

  const [uploaderFilter, setUploaderFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [respectContext, setRespectContext] = useState(true);

  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [uploadCaption, setUploadCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressPercent, setUploadProgressPercent] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>(null);

  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState("");
  const [isSavingCaption, setIsSavingCaption] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const viewerDialogRef = useRef<HTMLElement | null>(null);
  const editDialogRef = useRef<HTMLElement | null>(null);
  const didInitializePhotoIds = useRef(false);
  const knownPhotoIdsRef = useRef<Set<string>>(new Set());
  const [newPhotoIds, setNewPhotoIds] = useState<Record<string, true>>({});

  const contextualMode = selectedTaskId ? "task" : selectedPhaseId ? "phase" : "none";
  const activePhoto = activePhotoId ? photos.find((photo) => photo.id === activePhotoId) || null : null;
  const editingPhoto = editingPhotoId ? photos.find((photo) => photo.id === editingPhotoId) || null : null;

  const uploaderOptions = useMemo(() => {
    const options = Array.from(new Set(photos.map((photo) => photo.uploadedBy).filter((value): value is string => Boolean(value))));
    return options
      .map((id) => ({ id, label: profiles[id] || t("projects.sitecamUnknownUploader") }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [photos, profiles, t]);

  const filteredPhotos = useMemo(() => {
    const next = photos.filter((photo) => {
      if (uploaderFilter !== "all" && photo.uploadedBy !== uploaderFilter) {
        return false;
      }

      return true;
    });

    return next.sort((a, b) => {
      const first = resolvePhotoDate(a).getTime();
      const second = resolvePhotoDate(b).getTime();
      return sortOrder === "newest" ? second - first : first - second;
    });
  }, [photos, sortOrder, uploaderFilter]);

  const previewPhotos = filteredPhotos.slice(0, 10);

  const viewerIndex = activePhotoId ? filteredPhotos.findIndex((photo) => photo.id === activePhotoId) : -1;
  const previousPhoto = viewerIndex > 0 ? filteredPhotos[viewerIndex - 1] : null;
  const nextPhoto = viewerIndex >= 0 && viewerIndex < filteredPhotos.length - 1 ? filteredPhotos[viewerIndex + 1] : null;

  const contextualMessage = useMemo(() => {
    if (!respectContext || contextualMode === "none") {
      return null;
    }

    if (contextualMode === "task") {
      return t("projects.workSitecamContextTaskUnsupported", {
        task: selectedTaskTitle || t("projects.workSitecamSelectedTaskFallback"),
      });
    }

    return t("projects.workSitecamContextPhaseUnsupported", {
      phase: selectedPhaseName || t("projects.workSitecamSelectedPhaseFallback"),
    });
  }, [contextualMode, respectContext, selectedPhaseName, selectedTaskTitle, t]);

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

      const loaded = await fetchProjectPhotos(supabase, companyId, projectId);

      if (!isSubscribed) {
        return;
      }

      if (loaded.error) {
        setErrorMessage(loaded.error);
        setPhotos([]);
        setSignedUrlByPath({});
        setIsLoading(false);
        return;
      }

      setPhotos(loaded.photos);
      knownPhotoIdsRef.current = new Set(loaded.photos.map((photo) => photo.id));
      didInitializePhotoIds.current = true;

      const urlResult = await createSignedUrlMap(supabase, loaded.photos.map((photo) => photo.storagePath));

      if (!isSubscribed) {
        return;
      }

      if (urlResult.error) {
        setErrorMessage(urlResult.error);
      }

      setSignedUrlByPath(urlResult.urls);
      setIsLoading(false);
    };

    void run();

    return () => {
      isSubscribed = false;
    };
  }, [companyId, projectId, supabase, t]);

  useEffect(() => {
    if (!didInitializePhotoIds.current) {
      return;
    }

    if (!hasAnimatedEntries(newPhotoIds)) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setNewPhotoIds({});
    }, 420);

    return () => window.clearTimeout(timeout);
  }, [newPhotoIds]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActivePhotoId(null);
        setEditingPhotoId(null);
      }

      if (event.key === "ArrowLeft" && previousPhoto) {
        setActivePhotoId(previousPhoto.id);
      }

      if (event.key === "ArrowRight" && nextPhoto) {
        setActivePhotoId(nextPhoto.id);
      }
    };

    if (activePhoto || editingPhoto) {
      window.addEventListener("keydown", onKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.removeProperty("overflow");
    };
  }, [activePhoto, editingPhoto, nextPhoto, previousPhoto]);

  const refreshPhotos = async () => {
    if (!supabase) {
      return;
    }

    const loaded = await fetchProjectPhotos(supabase, companyId, projectId);

    if (loaded.error) {
      setErrorMessage(loaded.error);
      return;
    }

    setPhotos((previous) => {
      const previousIds = new Set(previous.map((photo) => photo.id));
      const nextNew = didInitializePhotoIds.current
        ? collectNewEntityIds(previousIds, loaded.photos.map((photo) => photo.id))
        : {};

      knownPhotoIdsRef.current = new Set(loaded.photos.map((photo) => photo.id));
      if (hasAnimatedEntries(nextNew)) {
        setNewPhotoIds(nextNew);
      }
      didInitializePhotoIds.current = true;
      return loaded.photos;
    });

    const urlResult = await createSignedUrlMap(supabase, loaded.photos.map((photo) => photo.storagePath));

    if (urlResult.error) {
      setErrorMessage(urlResult.error);
    } else {
      setErrorMessage(null);
    }

    setSignedUrlByPath(urlResult.urls);
  };

  const onSelectUploadFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) {
      return;
    }

    const nextQueue: UploadItem[] = [];
    const errors: string[] = [];

    files.forEach((file) => {
      const validation = validateImage(file, t);

      if (!validation.ok) {
        errors.push(validation.message);
        return;
      }

      nextQueue.push({
        id: crypto.randomUUID(),
        file,
      });
    });

    if (errors.length > 0) {
      setUploadStatus({ kind: "error", message: errors[0] });
    }

    if (nextQueue.length > 0) {
      setUploadQueue((previous) => [...previous, ...nextQueue]);
      setUploadStatus({ kind: "info", message: t("projects.sitecamFilesQueued", { count: nextQueue.length }) });
    }

    event.currentTarget.value = "";
  };

  const removeQueuedUpload = (uploadId: string) => {
    setUploadQueue((previous) => previous.filter((item) => item.id !== uploadId));
  };

  const uploadPhotos = async () => {
    if (!supabase) {
      setUploadStatus({ kind: "error", message: t("projects.errorConnect") });
      return;
    }

    if (uploadQueue.length === 0) {
      setUploadStatus({ kind: "error", message: t("projects.sitecamValidationNoFiles") });
      return;
    }

    setIsUploading(true);
    setUploadProgressPercent(0);
    setUploadStatus({ kind: "info", message: t("projects.sitecamUploadInProgress") });

    let successCount = 0;
    let failedCount = 0;

    const total = uploadQueue.length;

    for (let index = 0; index < uploadQueue.length; index += 1) {
      const queued = uploadQueue[index];
      const photoId = crypto.randomUUID();
      const storagePath = `${companyId}/${projectId}/${photoId}/${sanitizeFilename(queued.file.name)}`;

      const uploadResult = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, queued.file, {
          upsert: false,
          contentType: queued.file.type || undefined,
        });

      if (uploadResult.error) {
        failedCount += 1;
        setUploadProgressPercent(Math.round(((index + 1) / total) * 100));
        continue;
      }

      const insertResult = await supabase
        .from("project_photos")
        .insert({
          id: photoId,
          company_id: companyId,
          project_id: projectId,
          uploaded_by: userId,
          storage_path: storagePath,
          original_filename: queued.file.name,
          mime_type: queued.file.type || null,
          file_size: queued.file.size,
          note: uploadCaption.trim() || null,
          captured_at: new Date().toISOString(),
        });

      if (insertResult.error) {
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
        failedCount += 1;
        setUploadProgressPercent(Math.round(((index + 1) / total) * 100));
        continue;
      }

      successCount += 1;
      setUploadProgressPercent(Math.round(((index + 1) / total) * 100));
    }

    setIsUploading(false);
    setUploadStatus({ kind: failedCount > 0 ? "error" : "success", message: t("projects.sitecamUploadSummary", { success: successCount, failed: failedCount }) });

    if (successCount > 0) {
      setUploadQueue([]);
      setUploadCaption("");
      await refreshPhotos();
    }

    setUploadProgressPercent(0);
  };

  const saveCaption = async () => {
    if (!supabase || !editingPhoto) {
      return;
    }

    setIsSavingCaption(true);

    const result = await supabase
      .from("project_photos")
      .update({ note: captionDraft.trim() || null })
      .eq("id", editingPhoto.id)
      .eq("company_id", companyId)
      .eq("project_id", projectId);

    setIsSavingCaption(false);

    if (result.error) {
      setUploadStatus({ kind: "error", message: t("projects.sitecamUpdateFailed", { message: result.error.message }) });
      return;
    }

    setEditingPhotoId(null);
    setUploadStatus({ kind: "success", message: t("projects.sitecamUpdateSuccess") });
    await refreshPhotos();
  };

  const removePhoto = async (photo: ProjectPhotoRecord) => {
    if (!supabase || isDeletingPhoto) {
      return;
    }

    setIsDeletingPhoto(true);

    const storageResult = await supabase.storage.from(STORAGE_BUCKET).remove([photo.storagePath]);

    if (storageResult.error) {
      setIsDeletingPhoto(false);
      setUploadStatus({ kind: "error", message: t("projects.sitecamDeleteStorageFailed", { message: storageResult.error.message }) });
      return;
    }

    const deleteResult = await supabase
      .from("project_photos")
      .delete()
      .eq("id", photo.id)
      .eq("company_id", companyId)
      .eq("project_id", projectId);

    setIsDeletingPhoto(false);

    if (deleteResult.error) {
      setUploadStatus({ kind: "error", message: t("projects.sitecamDeleteFailed", { message: deleteResult.error.message }) });
      return;
    }

    setActivePhotoId(null);
    setUploadStatus({ kind: "success", message: t("projects.sitecamDeleteSuccess") });
    await refreshPhotos();
  };

  const openEdit = (photo: ProjectPhotoRecord) => {
    setCaptionDraft(photo.note || "");
    setEditingPhotoId(photo.id);
  };

  useFocusTrap({
    active: Boolean(activePhoto),
    containerRef: viewerDialogRef,
    onEscape: () => setActivePhotoId(null),
  });

  useFocusTrap({
    active: Boolean(editingPhoto),
    containerRef: editDialogRef,
    onEscape: () => setEditingPhotoId(null),
  });

  return (
    <WorkspaceEnvironment workspace="camera" routeKey={`${projectId}:work-sitecam`} className="bf-sitecam-environment">
      <Card as="section" variant="elevated" className="rounded-[16px] shadow-[var(--shadow-small)]">
      <CardHeader className="bg-[var(--color-surface-subtle)]/55">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--color-success-100)] text-[var(--color-success-700)]">
              <Camera size={15} aria-hidden="true" />
            </span>
            <div>
              <CardTitle className="text-[1.1rem] font-bold text-[var(--color-navy-900)]">{t("projects.sitecamTitle")}</CardTitle>
              <p className="text-sm text-[var(--color-text-secondary)]">{t("projects.workSitecamPanelDescription")}</p>
            </div>
          </div>
          <Link href={`/projects/${projectId}?tab=documents`} className="inline-flex">
            <Button size="sm" variant="outline">{t("projects.workSitecamViewAll")}</Button>
          </Link>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-5">
        {contextualMessage ? (
          <div className="rounded-[12px] border border-[var(--color-warning-200)] bg-[var(--color-warning-50)] px-3 py-2">
            <p className="text-xs text-[var(--color-warning-800)]">{contextualMessage}</p>
            <button
              type="button"
              className="mt-1 text-xs font-semibold text-[var(--color-warning-800)] underline"
              onClick={() => setRespectContext(false)}
            >
              {t("projects.workSitecamClearContext")}
            </button>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{t("projects.sitecamFilterUploader")}</span>
            <select
              value={uploaderFilter}
              onChange={(event) => setUploaderFilter(event.target.value)}
              className="h-10 w-full rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-500)]"
            >
              <option value="all">{t("projects.sitecamAllUploaders")}</option>
              {uploaderOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{t("projects.workSitecamSortLabel")}</span>
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as "newest" | "oldest")}
              className="h-10 w-full rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-500)]"
            >
              <option value="newest">{t("projects.workSitecamSortNewest")}</option>
              <option value="oldest">{t("projects.workSitecamSortOldest")}</option>
            </select>
          </label>
        </div>

        <div className="rounded-[12px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]/55 p-3">
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/*"
            className="sr-only"
            multiple
            onChange={onSelectUploadFiles}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => uploadInputRef.current?.click()}>
              {t("projects.sitecamUploadPhotos")}
            </Button>
            <Button type="button" size="sm" disabled={isUploading || uploadQueue.length === 0} onClick={() => void uploadPhotos()}>
              {isUploading ? t("projects.sitecamUploadInProgress") : t("projects.sitecamStartUpload")}
            </Button>
          </div>

          {isUploading ? (
            <div className="mt-3">
              <AnimatedProgress
                value={uploadProgressPercent}
                className="h-2"
                trackClassName="bg-[var(--color-surface-muted)]"
                fillClassName="bg-[var(--color-info-500)]"
                durationMs={140}
              />
              <p className="mt-1 text-[11px] font-medium text-[var(--color-text-secondary)]">
                {t("projects.sitecamUploadInProgress")} ({uploadProgressPercent}%)
              </p>
            </div>
          ) : null}

          <label className="mt-3 block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{t("projects.workSitecamCaptionLabel")}</span>
            <textarea
              value={uploadCaption}
              onChange={(event) => setUploadCaption(event.target.value)}
              maxLength={500}
              className="min-h-20 w-full rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)]"
              placeholder={t("projects.sitecamNotePlaceholder")}
            />
          </label>

          {uploadQueue.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {uploadQueue.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 text-xs text-[var(--color-text-secondary)]">
                  <span className="truncate">{item.file.name}</span>
                  <button type="button" className="font-semibold text-[var(--color-danger-700)]" onClick={() => removeQueuedUpload(item.id)}>
                    {t("projects.sitecamRemoveFile")}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {uploadStatus ? (
            <p className={`mt-3 text-xs font-medium ${uploadStatus.kind === "error" ? "text-[var(--color-danger-700)]" : uploadStatus.kind === "success" ? "text-[var(--color-success-700)]" : "text-[var(--color-info-700)]"}`}>
              {uploadStatus.message}
            </p>
          ) : null}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="h-28 rounded-[10px] bg-[var(--color-surface-subtle)]" />
            <div className="h-28 rounded-[10px] bg-[var(--color-surface-subtle)]" />
            <div className="h-28 rounded-[10px] bg-[var(--color-surface-subtle)]" />
            <div className="h-28 rounded-[10px] bg-[var(--color-surface-subtle)]" />
          </div>
        ) : errorMessage ? (
          <ErrorState compact title={t("projects.sitecamLoadErrorTitle")} description={errorMessage} />
        ) : previewPhotos.length === 0 ? (
          <EmptyState compact icon="S" title={t("projects.sitecamEmptyTitle")} description={t("projects.workSitecamEmptyFilteredDescription")} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {previewPhotos.map((photo) => (
              <FadeIn key={photo.id} durationMs={newPhotoIds[photo.id] ? 210 : 0} className={newPhotoIds[photo.id] ? "" : "bf-no-motion"}>
                <article className="overflow-hidden rounded-[12px] border border-[var(--color-border-subtle)] bg-white">
                <button type="button" className="block h-28 w-full bg-[var(--color-surface-subtle)]" onClick={() => setActivePhotoId(photo.id)}>
                  {signedUrlByPath[photo.storagePath] ? (
                    <img
                      src={signedUrlByPath[photo.storagePath]}
                      alt={photo.note || t("projects.sitecamImageAlt", { category: photo.category || t("projects.sitecamCategoryOther") })}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-xs font-semibold text-[var(--color-text-muted)]">{t("projects.sitecamImageUnavailable")}</span>
                  )}
                </button>
                <div className="space-y-1 p-2.5">
                  <p className="line-clamp-2 text-xs text-[var(--color-text-primary)]">{photo.note || t("projects.sitecamNoNote")}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">{formatDate(resolvePhotoDate(photo))}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">{t("projects.sitecamMetaUploader")}: {photo.uploadedBy ? profiles[photo.uploadedBy] || t("projects.sitecamUnknownUploader") : t("projects.notAssigned")}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">{t("projects.workSitecamMetaPhase")}: {t("projects.workSitecamNotLinked")}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">{t("projects.workSitecamMetaTask")}: {t("projects.workSitecamNotLinked")}</p>
                </div>
                </article>
              </FadeIn>
            ))}
          </div>
        )}
      </CardContent>

      {activePhoto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label={t("projects.close")} className="absolute inset-0 bg-slate-950/60" onClick={() => setActivePhotoId(null)} />
          <FadeIn durationMs={180} distancePx={4} className="relative z-10 w-full max-w-4xl">
          <article
            ref={viewerDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("projects.sitecamViewerTitle")}
            tabIndex={-1}
            className="max-h-[92vh] overflow-auto rounded-[16px] bg-white shadow-[var(--shadow-large)]"
          >
            <div className="grid gap-0 lg:grid-cols-[1.6fr_1fr]">
              <div className="min-h-80 bg-[var(--color-surface-subtle)]">
                {signedUrlByPath[activePhoto.storagePath] ? (
                  <img
                    src={signedUrlByPath[activePhoto.storagePath]}
                    alt={activePhoto.note || t("projects.sitecamImageAlt", { category: activePhoto.category || t("projects.sitecamCategoryOther") })}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full min-h-80 items-center justify-center text-sm font-semibold text-[var(--color-text-muted)]">
                    {t("projects.sitecamImageUnavailable")}
                  </div>
                )}
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{t("projects.sitecamViewerTitle")}</h3>
                  <Button size="sm" variant="outline" onClick={() => setActivePhotoId(null)}>{t("projects.close")}</Button>
                </div>

                <p className="text-sm text-[var(--color-text-secondary)]">{activePhoto.note || t("projects.sitecamNoNote")}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{t("projects.sitecamMetaUploaded")}: {formatDate(resolvePhotoDate(activePhoto))}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{t("projects.sitecamMetaUploader")}: {activePhoto.uploadedBy ? profiles[activePhoto.uploadedBy] || t("projects.sitecamUnknownUploader") : t("projects.notAssigned")}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{t("projects.workSitecamMetaPhase")}: {t("projects.workSitecamNotLinked")}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{t("projects.workSitecamMetaTask")}: {t("projects.workSitecamNotLinked")}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{t("projects.sitecamMetaProject")}: {projectName}</p>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => openEdit(activePhoto)}>{t("projects.workSitecamEditCaption")}</Button>
                  <Button type="button" size="sm" variant="danger" disabled={isDeletingPhoto} onClick={() => void removePhoto(activePhoto)}>
                    {isDeletingPhoto ? t("projects.sitecamDeleting") : t("projects.sitecamActionDelete")}
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2">
                  <Button type="button" size="sm" variant="outline" disabled={!previousPhoto} onClick={() => previousPhoto && setActivePhotoId(previousPhoto.id)}>
                    <ChevronLeft size={14} aria-hidden="true" />
                    {t("projects.workSitecamPrevious")}
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={!nextPhoto} onClick={() => nextPhoto && setActivePhotoId(nextPhoto.id)}>
                    {t("projects.workSitecamNext")}
                    <ChevronRight size={14} aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </div>
          </article>
          </FadeIn>
        </div>
      ) : null}

      {editingPhoto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label={t("projects.close")} className="absolute inset-0 bg-slate-950/60" onClick={() => setEditingPhotoId(null)} />
          <FadeIn durationMs={180} distancePx={4} className="relative z-10 w-full max-w-lg">
          <article
            ref={editDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("projects.workSitecamEditCaption")}
            tabIndex={-1}
            className="rounded-[16px] bg-white p-5 shadow-[var(--shadow-large)]"
          >
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{t("projects.workSitecamEditCaption")}</h3>
            <label className="mt-3 block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{t("projects.workSitecamCaptionLabel")}</span>
              <textarea
                value={captionDraft}
                onChange={(event) => setCaptionDraft(event.target.value)}
                maxLength={500}
                className="min-h-24 w-full rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)]"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditingPhotoId(null)}>{t("projects.cancel")}</Button>
              <Button size="sm" disabled={isSavingCaption} onClick={() => void saveCaption()}>{isSavingCaption ? t("projects.sitecamSaving") : t("projects.sitecamSave")}</Button>
            </div>
          </article>
          </FadeIn>
        </div>
      ) : null}
      </Card>
    </WorkspaceEnvironment>
  );
}

async function fetchProjectPhotos(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  projectId: string,
): Promise<{ photos: ProjectPhotoRecord[]; error: string | null }> {
  if (!supabase) {
    return { photos: [], error: null };
  }

  const result = await supabase
    .from("project_photos")
    .select("id, project_id, company_id, uploaded_by, storage_path, note, category, captured_at, created_at, original_filename, mime_type, file_size")
    .eq("company_id", companyId)
    .eq("project_id", projectId)
    .order("captured_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (result.error) {
    return { photos: [], error: result.error.message };
  }

  const photos = ((result.data || []) as ProjectPhotoRow[]).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    companyId: row.company_id,
    uploadedBy: row.uploaded_by,
    storagePath: row.storage_path,
    note: row.note,
    category: row.category,
    capturedAt: row.captured_at,
    createdAt: row.created_at,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSize: row.file_size,
  }));

  return { photos, error: null };
}

async function createSignedUrlMap(
  supabase: ReturnType<typeof createClient>,
  storagePaths: string[],
): Promise<{ urls: Record<string, string>; error: string | null }> {
  if (!supabase || storagePaths.length === 0) {
    return { urls: {}, error: null };
  }

  const result = await supabase.storage.from(STORAGE_BUCKET).createSignedUrls(storagePaths, 60 * 60);

  if (result.error) {
    return { urls: {}, error: result.error.message };
  }

  const urls = (result.data || []).reduce<Record<string, string>>((acc, item, index) => {
    const path = storagePaths[index];

    if (path && item?.signedUrl) {
      acc[path] = item.signedUrl;
    }

    return acc;
  }, {});

  return { urls, error: null };
}

function validateImage(file: File, t: (key: string, params?: Record<string, string | number>) => string) {
  const acceptedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);
  const lowerName = file.name.toLowerCase();
  const isHeic = lowerName.endsWith(".heic");

  if (!acceptedMimeTypes.has(file.type) && !isHeic) {
    return { ok: false as const, message: t("projects.sitecamValidationType", { filename: file.name }) };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false as const, message: t("projects.sitecamValidationSize", { filename: file.name, max: "10MB" }) };
  }

  return { ok: true as const, message: "" };
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

function resolvePhotoDate(photo: ProjectPhotoRecord) {
  const normalized = new Date(photo.capturedAt || photo.createdAt);

  if (Number.isNaN(normalized.getTime())) {
    return new Date(photo.createdAt);
  }

  return normalized;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}
