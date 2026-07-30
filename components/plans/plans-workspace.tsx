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

const documentsSeed: PlanDocument[] = [
  {
    id: "doc-a101",
    fileName: "A101-Floor-Plan-Level-01.pdf",
    discipline: "Architectural",
    revision: "A3",
    status: "Approved",
    uploadedBy: "Lena Ortiz",
    uploadedAt: "2026-07-10",
    sizeInBytes: 4_920_000,
    linkedRfis: 2,
    linkedSubmittals: 1,
    revisionHistory: [
      { id: "a101-r1", revision: "A1", issuedAt: "2026-05-03", approvedBy: "M. Park", approvalStatus: "Superseded", notes: "Initial issue for coordination." },
      { id: "a101-r2", revision: "A2", issuedAt: "2026-06-11", approvedBy: "M. Park", approvalStatus: "Superseded", notes: "Door schedule updates." },
      { id: "a101-r3", revision: "A3", issuedAt: "2026-07-10", approvedBy: "M. Park", approvalStatus: "Current", notes: "Final IFC release." },
    ],
  },
  {
    id: "doc-s201",
    fileName: "S201-Framing-Plan-Level-02.pdf",
    discipline: "Structural",
    revision: "S2",
    status: "In Review",
    uploadedBy: "Ivan Brooks",
    uploadedAt: "2026-07-19",
    sizeInBytes: 3_220_000,
    linkedRfis: 3,
    linkedSubmittals: 2,
    revisionHistory: [
      { id: "s201-r1", revision: "S1", issuedAt: "2026-06-22", approvedBy: "R. Chen", approvalStatus: "Superseded", notes: "Beam layout baseline." },
      { id: "s201-r2", revision: "S2", issuedAt: "2026-07-19", approvedBy: "R. Chen", approvalStatus: "Pending", notes: "Transfer girder revision." },
    ],
  },
  {
    id: "doc-m301",
    fileName: "M301-Mechanical-Riser-Diagram.pdf",
    discipline: "Mechanical",
    revision: "M4",
    status: "Approved",
    uploadedBy: "Priya Nair",
    uploadedAt: "2026-07-12",
    sizeInBytes: 2_780_000,
    linkedRfis: 1,
    linkedSubmittals: 2,
    revisionHistory: [
      { id: "m301-r4", revision: "M4", issuedAt: "2026-07-12", approvedBy: "E. Gomez", approvalStatus: "Approved", notes: "Duct path clearance verified." },
    ],
  },
  {
    id: "doc-e110",
    fileName: "E110-Lighting-Plan-Level-01.pdf",
    discipline: "Electrical",
    revision: "E5",
    status: "Draft",
    uploadedBy: "Chris Alarcon",
    uploadedAt: "2026-07-21",
    sizeInBytes: 1_690_000,
    linkedRfis: 0,
    linkedSubmittals: 1,
    revisionHistory: [
      { id: "e110-r5", revision: "E5", issuedAt: "2026-07-21", approvedBy: "N/A", approvalStatus: "Pending", notes: "Awaiting photometric review." },
    ],
  },
  {
    id: "doc-p410",
    fileName: "P410-Plumbing-Isometrics.pdf",
    discipline: "Plumbing",
    revision: "P2",
    status: "In Review",
    uploadedBy: "Nadia Ellis",
    uploadedAt: "2026-07-15",
    sizeInBytes: 2_140_000,
    linkedRfis: 1,
    linkedSubmittals: 1,
    revisionHistory: [
      { id: "p410-r1", revision: "P1", issuedAt: "2026-06-30", approvedBy: "C. Holmes", approvalStatus: "Superseded", notes: "Initial sanitary routing." },
      { id: "p410-r2", revision: "P2", issuedAt: "2026-07-15", approvedBy: "C. Holmes", approvalStatus: "Pending", notes: "Slope corrections at core." },
    ],
  },
  {
    id: "doc-f501",
    fileName: "FP501-Fire-Sprinkler-Zones.pdf",
    discipline: "Fire Protection",
    revision: "FP3",
    status: "Approved",
    uploadedBy: "Jordan Yu",
    uploadedAt: "2026-07-08",
    sizeInBytes: 1_950_000,
    linkedRfis: 2,
    linkedSubmittals: 0,
    revisionHistory: [
      { id: "f501-r3", revision: "FP3", issuedAt: "2026-07-08", approvedBy: "D. Martin", approvalStatus: "Approved", notes: "Hydraulic calc updates accepted." },
    ],
  },
  {
    id: "doc-spec-001",
    fileName: "Spec-Section-033000-Cast-In-Place-Concrete.pdf",
    discipline: "Specifications",
    revision: "00",
    status: "Approved",
    uploadedBy: "Admin Team",
    uploadedAt: "2026-07-03",
    sizeInBytes: 890_000,
    linkedRfis: 1,
    linkedSubmittals: 3,
    revisionHistory: [
      { id: "spec-1", revision: "00", issuedAt: "2026-07-03", approvedBy: "A. Wu", approvalStatus: "Approved", notes: "Issued for construction." },
    ],
  },
  {
    id: "doc-permit-12",
    fileName: "Permit-Mechanical-Revision-12.pdf",
    discipline: "Permits",
    revision: "12",
    status: "Approved",
    uploadedBy: "City Portal Sync",
    uploadedAt: "2026-07-05",
    sizeInBytes: 560_000,
    linkedRfis: 0,
    linkedSubmittals: 0,
    revisionHistory: [
      { id: "permit-12", revision: "12", issuedAt: "2026-07-05", approvedBy: "City Reviewer", approvalStatus: "Approved", notes: "Mechanical permit approved." },
    ],
  },
  {
    id: "doc-photo-77",
    fileName: "Site-Photo-North-Elevation-2026-07-18.jpg",
    discipline: "Photos",
    revision: "P1",
    status: "Archived",
    uploadedBy: "Field Capture",
    uploadedAt: "2026-07-18",
    sizeInBytes: 3_410_000,
    linkedRfis: 1,
    linkedSubmittals: 0,
    revisionHistory: [
      { id: "photo-77", revision: "P1", issuedAt: "2026-07-18", approvedBy: "Field Lead", approvalStatus: "Current", notes: "Progress photo archived for record." },
    ],
  },
  {
    id: "doc-c101",
    fileName: "C101-Site-Grading-Plan.pdf",
    discipline: "Civil",
    revision: "C2",
    status: "Superseded",
    uploadedBy: "Ivy Stone",
    uploadedAt: "2026-06-29",
    sizeInBytes: 1_730_000,
    linkedRfis: 4,
    linkedSubmittals: 1,
    revisionHistory: [
      { id: "c101-r1", revision: "C1", issuedAt: "2026-05-27", approvedBy: "D. Palmer", approvalStatus: "Superseded", notes: "Original grading intent." },
      { id: "c101-r2", revision: "C2", issuedAt: "2026-06-29", approvedBy: "D. Palmer", approvalStatus: "Superseded", notes: "Replaced by C3 package." },
    ],
  },
  {
    id: "doc-arch-archive-2",
    fileName: "A099-Demolition-Plan-Legacy.pdf",
    discipline: "Archived",
    revision: "A0",
    status: "Archived",
    uploadedBy: "Archive Bot",
    uploadedAt: "2026-05-13",
    sizeInBytes: 2_020_000,
    linkedRfis: 0,
    linkedSubmittals: 0,
    revisionHistory: [
      { id: "a099-archive", revision: "A0", issuedAt: "2026-05-13", approvedBy: "Archive Bot", approvalStatus: "Superseded", notes: "Legacy plan superseded by A101 set." },
    ],
  },
];

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
