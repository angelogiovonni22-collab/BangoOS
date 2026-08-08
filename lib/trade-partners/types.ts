import type { Database } from "@/types/database.types";

export const TRADE_PARTNER_ASSIGNMENT_STATUSES = ["active", "inactive", "archived"] as const;
export type TradePartnerAssignmentStatus = (typeof TRADE_PARTNER_ASSIGNMENT_STATUSES)[number];

export const TRADE_PARTNER_CONTRACT_STATUSES = ["draft", "pending_signature", "signed", "cancelled", "closed"] as const;
export type TradePartnerContractStatus = (typeof TRADE_PARTNER_CONTRACT_STATUSES)[number];

export type TradePartnerAssignmentRow = Database["public"]["Tables"]["trade_partner_assignments"]["Row"];

export type TradePartnerAssignment = {
  id: string;
  companyId: string;
  projectId: string;
  vendorId: string;
  tradeName: string;
  scopeOfWork: string | null;
  primaryContactName: string | null;
  primaryContactPhone: string | null;
  primaryContactEmail: string | null;
  contractStatus: TradePartnerContractStatus;
  contractAmount: number | null;
  paymentTerms: string | null;
  retainagePercent: number | null;
  startDate: string | null;
  targetCompletionDate: string | null;
  crewSize: number | null;
  assignmentStatus: TradePartnerAssignmentStatus;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateTradePartnerAssignmentInput = {
  projectId: string;
  vendorId: string;
  tradeName: string;
  scopeOfWork?: string | null;
  primaryContactName?: string | null;
  primaryContactPhone?: string | null;
  primaryContactEmail?: string | null;
  contractStatus?: TradePartnerContractStatus;
  contractAmount?: number | null;
  paymentTerms?: string | null;
  retainagePercent?: number | null;
  startDate?: string | null;
  targetCompletionDate?: string | null;
  crewSize?: number | null;
  assignmentStatus?: TradePartnerAssignmentStatus;
  notes?: string | null;
};

export type UpdateTradePartnerAssignmentInput = {
  tradeName?: string;
  scopeOfWork?: string | null;
  primaryContactName?: string | null;
  primaryContactPhone?: string | null;
  primaryContactEmail?: string | null;
  contractStatus?: TradePartnerContractStatus;
  contractAmount?: number | null;
  paymentTerms?: string | null;
  retainagePercent?: number | null;
  startDate?: string | null;
  targetCompletionDate?: string | null;
  crewSize?: number | null;
  notes?: string | null;
};

export type TradePartnerAssignmentListFilters = {
  projectId: string;
  assignmentStatus?: TradePartnerAssignmentStatus | "all";
};
