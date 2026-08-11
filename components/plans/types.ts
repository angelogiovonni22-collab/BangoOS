import type { LucideIcon } from "lucide-react";

export type DocumentDiscipline =
  | "Architectural"
  | "Structural"
  | "Civil"
  | "Mechanical"
  | "Electrical"
  | "Plumbing"
  | "Fire Protection"
  | "Specifications"
  | "Permits"
  | "Photos"
  | "Archived";

export type DocumentStatus = "Draft" | "In Review" | "Approved" | "Superseded" | "Archived";

export type RevisionStatus = "Current" | "Superseded" | "Pending" | "Approved";

export type RevisionItem = {
  id: string;
  revision: string;
  issuedAt: string;
  approvedBy: string;
  approvalStatus: RevisionStatus;
  notes: string;
};

export type PlanDocument = {
  id: string;
  fileName: string;
  originalFileName?: string;
  discipline: DocumentDiscipline;
  revision: string;
  status: DocumentStatus;
  uploadedBy: string;
  uploadedAt: string;
  sizeInBytes: number;
  linkedRfis: number;
  linkedSubmittals: number;
  revisionHistory: RevisionItem[];
  fileUrl?: string | null;
  mimeType?: string;
};

export type PlanFolder = {
  id: string;
  label: string;
  icon: LucideIcon;
  count: number;
  children?: PlanFolder[];
};

export type PlansSortKey =
  | "fileName"
  | "discipline"
  | "revision"
  | "status"
  | "uploadedBy"
  | "uploadedAt"
  | "sizeInBytes"
  | "linkedRfis";

export type PlansSortDirection = "asc" | "desc";
