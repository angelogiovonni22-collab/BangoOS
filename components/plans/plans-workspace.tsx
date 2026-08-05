"use client";

import { useMemo, useState } from "react";
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
};

type FolderDefinition = {
  id: string;
  label: string;
  icon: PlanFolder["icon"];
  children?: FolderDefinition[];
};

const documentsSeed: PlanDocument[] = [];

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

export function PlansWorkspace({ projectName }: PlansWorkspaceProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState<"all" | DocumentDiscipline>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | DocumentStatus>("all");
  const [sortKey, setSortKey] = useState<PlansSortKey>("uploadedAt");
  const [sortDirection, setSortDirection] = useState<PlansSortDirection>("desc");
  const [activeFolderId, setActiveFolderId] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedDocumentId, setFocusedDocumentId] = useState<string | null>(documentsSeed[0]?.id || null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const folders = useMemo(() => {
    const countByDiscipline = documentsSeed.reduce<Record<string, number>>((accumulator, document) => {
      accumulator[document.discipline] = (accumulator[document.discipline] || 0) + 1;
      return accumulator;
    }, {});

    const mapFolder = (folder: FolderDefinition): PlanFolder => {
      const discipline = folderDisciplineMap[folder.id];
      const count = discipline === "all"
        ? documentsSeed.length
        : countByDiscipline[discipline] || 0;

      return {
        ...folder,
        count,
        children: folder.children ? folder.children.map(mapFolder) : undefined,
      };
    };

    return folderDefinitions.map(mapFolder);
  }, []);

  const filteredDocuments = useMemo(() => {
    const activeDiscipline = folderDisciplineMap[activeFolderId] || "all";

    return documentsSeed.filter((document) => {
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
  }, [activeFolderId, disciplineFilter, searchTerm, statusFilter]);

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
      return documentsSeed.find((document) => document.id === focusedDocumentId) || null;
    }

    return sortedDocuments[0] || null;
  }, [focusedDocumentId, sortedDocuments]);

  const latestRevisionDate = useMemo(() => {
    const latest = [...documentsSeed].sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt))[0];
    return latest ? latest.uploadedAt : "N/A";
  }, []);

  const pendingReviews = documentsSeed.filter((document) => document.status === "In Review").length;
  const openRfis = documentsSeed.reduce((sum, document) => sum + document.linkedRfis, 0);
  const openSubmittals = documentsSeed.reduce((sum, document) => sum + document.linkedSubmittals, 0);

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
      <PlansHeader projectName={projectName} documentCount={documentsSeed.length} lastRevisionDate={latestRevisionDate} />

      <PlansStats
        totalDocuments={documentsSeed.length}
        latestRevision={latestRevisionDate}
        pendingReviews={pendingReviews}
        openRfis={openRfis}
        openSubmittals={openSubmittals}
      />

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
          <PlansPreview selectedDocument={selectedDocument} projectName={projectName} />
        </div>
      </div>
    </div>
  );
}
