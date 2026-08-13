"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Building2,
  Camera,
  FileText,
  Flame,
  FolderOpen,
  Hammer,
  House,
  Pipette,
  Shield,
  Zap,
} from "lucide-react";
import { PlansHeader } from "./plans-header";
import { PlansPreview } from "./plans-preview";
import { PlansSidebar } from "./plans-sidebar";
import { PlansStats } from "./plans-stats";
import { PlansTable } from "./plans-table";
import { PlansToolbar } from "./plans-toolbar";
import { BlueprintUploadPanel } from "./blueprint-upload-panel";
import { BlueprintRevisionPanel } from "./blueprint-revision-panel";
import { BlueprintProjectImpact } from "./blueprint-project-impact";
import { createClient } from "@/lib/supabase/client";
import { loadProjectBlueprints } from "@/lib/blueprints/plan-room";
import type {
  DocumentDiscipline,
  DocumentStatus,
  PlanDocument,
  PlanFolder,
  PlansSortDirection,
  PlansSortKey,
} from "./types";

type PlansWorkspaceProps = {
  projectName: string;
  projectId: string;
  companyId: string;
  userId: string;
};

type FolderDefinition = {
  id: string;
  label: string;
  icon: PlanFolder["icon"];
  children?: FolderDefinition[];
};

const folderDefinitions: FolderDefinition[] = [
  { id: "all", label: "All Documents", icon: FolderOpen },
  {
    id: "architectural",
    label: "Architectural",
    icon: House,
    children: [
      { id: "architectural-base", label: "Base Set", icon: FileText },
      { id: "architectural-shop", label: "Shop Drawings", icon: FileText },
    ],
  },
  { id: "structural", label: "Structural", icon: Building2 },
  { id: "civil", label: "Civil", icon: Hammer },
  { id: "mechanical", label: "Mechanical", icon: Pipette },
  { id: "electrical", label: "Electrical", icon: Zap },
  { id: "plumbing", label: "Plumbing", icon: Pipette },
  { id: "fire", label: "Fire Protection", icon: Flame },
  { id: "specifications", label: "Specifications", icon: FileText },
  { id: "permits", label: "Permits", icon: Shield },
  { id: "photos", label: "Photos", icon: Camera },
  { id: "archived", label: "Archived", icon: Archive },
];

const folderDisciplineMap: Record<string, DocumentDiscipline | "all"> = {
  all: "all",
  architectural: "Architectural",
  "architectural-base": "Architectural",
  "architectural-shop": "Architectural",
  structural: "Structural",
  civil: "Civil",
  mechanical: "Mechanical",
  electrical: "Electrical",
  plumbing: "Plumbing",
  fire: "Fire Protection",
  specifications: "Specifications",
  permits: "Permits",
  photos: "Photos",
  archived: "Archived",
};

export function PlansWorkspace({ projectName, projectId, companyId, userId }: PlansWorkspaceProps) {
  const supabase = useMemo(() => createClient(), []);
  const [documents, setDocuments] = useState<PlanDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [revisionDocument, setRevisionDocument] = useState<PlanDocument | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState<"all" | DocumentDiscipline>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | DocumentStatus>("all");
  const [sortKey, setSortKey] = useState<PlansSortKey>("uploadedAt");
  const [sortDirection, setSortDirection] = useState<PlansSortDirection>("desc");
  const [activeFolderId, setActiveFolderId] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedDocumentId, setFocusedDocumentId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const requestDocuments = useCallback(async () => {
    if (!supabase) {
      throw new Error("Blueprint storage is not available right now.");
    }
    return loadProjectBlueprints({ supabase, companyId, projectId });
  }, [companyId, projectId, supabase]);

  useEffect(() => {
    let subscribed = true;
    void requestDocuments()
      .then((nextDocuments) => {
        if (!subscribed) return;
        setLoadError(null);
        setDocuments(nextDocuments);
        setFocusedDocumentId((current) => current && nextDocuments.some((item) => item.id === current) ? current : nextDocuments[0]?.id || null);
      })
      .catch((error: unknown) => {
        if (!subscribed) return;
        const detail = error instanceof Error ? error.message : "Unable to load project blueprints.";
        setLoadError(detail.includes("blueprint_") ? "The Blueprint database foundation has not been deployed yet." : detail);
      })
      .finally(() => {
        if (subscribed) setLoading(false);
      });
    return () => { subscribed = false; };
  }, [reloadToken, requestDocuments]);

  const folders = useMemo(() => {
    const countByDiscipline = documents.reduce<Record<string, number>>((accumulator, document) => {
      accumulator[document.discipline] = (accumulator[document.discipline] || 0) + 1;
      return accumulator;
    }, {});

    const mapFolder = (folder: FolderDefinition): PlanFolder => {
      const discipline = folderDisciplineMap[folder.id];
      const count = discipline === "all"
        ? documents.length
        : countByDiscipline[discipline] || 0;

      return {
        ...folder,
        count,
        children: folder.children ? folder.children.map(mapFolder) : undefined,
      };
    };

    return folderDefinitions.map(mapFolder);
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const activeDiscipline = folderDisciplineMap[activeFolderId] || "all";

    return documents.filter((document) => {
      if (activeDiscipline !== "all" && document.discipline !== activeDiscipline) {
        return false;
      }

      if (disciplineFilter !== "all" && document.discipline !== disciplineFilter) {
        return false;
      }

      if (statusFilter !== "all" && document.status !== statusFilter) {
        return false;
      }

      if (!searchTerm.trim()) {
        return true;
      }

      const normalizedSearch = searchTerm.toLowerCase();
      return [document.fileName, document.discipline, document.revision, document.uploadedBy]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [activeFolderId, disciplineFilter, documents, searchTerm, statusFilter]);

  const sortedDocuments = useMemo(() => {
    const items = [...filteredDocuments];

    items.sort((left, right) => {
      const direction = sortDirection === "asc" ? 1 : -1;

      if (sortKey === "sizeInBytes" || sortKey === "linkedRfis") {
        return (left[sortKey] - right[sortKey]) * direction;
      }

      const leftValue = String(left[sortKey]).toLowerCase();
      const rightValue = String(right[sortKey]).toLowerCase();
      return leftValue.localeCompare(rightValue) * direction;
    });

    return items;
  }, [filteredDocuments, sortDirection, sortKey]);

  const selectedCount = useMemo(() => {
    return sortedDocuments.filter((document) => selectedIds.has(document.id)).length;
  }, [selectedIds, sortedDocuments]);

  const selectedDocument = useMemo(() => {
    if (focusedDocumentId) {
      return documents.find((document) => document.id === focusedDocumentId) || null;
    }

    return sortedDocuments[0] || null;
  }, [documents, focusedDocumentId, sortedDocuments]);

  const latestRevisionDate = useMemo(() => {
    const latest = [...documents].sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt))[0];
    return latest ? latest.uploadedAt : "N/A";
  }, [documents]);
  const latestRevisionLabel = useMemo(() => {
    const latest = [...documents].sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt))[0];
    return latest ? latest.revision : "N/A";
  }, [documents]);
  const duplicateSheetCount = useMemo(() => {
    const identities = documents.map((document) => `${document.discipline}:${document.fileName.toLowerCase()}`);
    return identities.length - new Set(identities).size;
  }, [documents]);

  const pendingReviews = documents.filter((document) => document.status === "In Review").length;
  const openRfis = documents.reduce((sum, document) => sum + document.linkedRfis, 0);
  const openSubmittals = documents.reduce((sum, document) => sum + document.linkedSubmittals, 0);

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(sortedDocuments.map((document) => document.id)));
      return;
    }

    setSelectedIds(new Set());
  };

  const handleToggleSelect = (documentId: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(documentId);
      } else {
        next.delete(documentId);
      }

      return next;
    });
  };

  const handleSortRequest = (key: PlansSortKey) => {
    if (key === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  };

  return (
    <div className="space-y-5">
      <PlansHeader projectName={projectName} documentCount={documents.length} lastRevisionDate={latestRevisionDate} onUpload={() => setUploadOpen(true)} />

      {uploadOpen ? (
        <BlueprintUploadPanel
          companyId={companyId}
          projectId={projectId}
          userId={userId}
          onClose={() => setUploadOpen(false)}
          onUploaded={() => { setUploadOpen(false); setLoading(true); setReloadToken((current) => current + 1); }}
        />
      ) : null}

      {revisionDocument ? (
        <BlueprintRevisionPanel
          companyId={companyId}
          projectId={projectId}
          document={revisionDocument}
          onClose={() => setRevisionDocument(null)}
          onUploaded={() => { setRevisionDocument(null); setLoading(true); setReloadToken((current) => current + 1); }}
        />
      ) : null}

      {loadError ? (
        <div className="rounded-[var(--radius-xl)] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800" role="alert">{loadError}</div>
      ) : null}

      {duplicateSheetCount > 0 ? (
        <div className="rounded-[var(--radius-xl)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900" role="status">
          {duplicateSheetCount} duplicate sheet record{duplicateSheetCount === 1 ? " was" : "s were"} detected from earlier upload attempts. BOS will preserve both until one is reviewed; new duplicate uploads are now blocked.
        </div>
      ) : null}

      {loading ? <p className="text-sm text-[var(--color-text-secondary)]" role="status">Loading blueprint plan room…</p> : null}

      <PlansStats
        totalDocuments={documents.length}
        latestRevision={latestRevisionLabel}
        pendingReviews={pendingReviews}
        openRfis={openRfis}
        openSubmittals={openSubmittals}
      />

      <BlueprintProjectImpact companyId={companyId} projectId={projectId} />

      <PlansToolbar
        searchTerm={searchTerm}
        disciplineFilter={disciplineFilter}
        statusFilter={statusFilter}
        sortKey={sortKey}
        sortDirection={sortDirection}
        selectedCount={selectedCount}
        sidebarOpen={sidebarOpen}
        onSearchTermChange={setSearchTerm}
        onDisciplineFilterChange={setDisciplineFilter}
        onStatusFilterChange={setStatusFilter}
        onSortKeyChange={setSortKey}
        onSortDirectionToggle={() => setSortDirection((current) => (current === "asc" ? "desc" : "asc"))}
        onToggleSidebar={() => setSidebarOpen((current) => !current)}
      />

      <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1.55fr)_minmax(0,1.05fr)] 2xl:grid-cols-[250px_minmax(0,1.7fr)_minmax(0,1.1fr)]">
        <PlansSidebar
          folders={folders}
          activeFolderId={activeFolderId}
          onFolderSelect={setActiveFolderId}
          isOpen={sidebarOpen}
        />

        <PlansTable
          documents={sortedDocuments}
          selectedIds={selectedIds}
          focusedDocumentId={focusedDocumentId}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onToggleSelectAll={handleToggleSelectAll}
          onToggleSelect={handleToggleSelect}
          onSelectDocument={setFocusedDocumentId}
          onSortRequest={handleSortRequest}
        />

        <div className="lg:col-span-2 xl:col-span-1 xl:min-w-0">
          <PlansPreview selectedDocument={selectedDocument} projectName={projectName} onUploadRevision={setRevisionDocument} companyId={companyId} projectId={projectId} userId={userId} />
        </div>
      </div>
    </div>
  );
}
