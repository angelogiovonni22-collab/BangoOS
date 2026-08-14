import {
  TRADE_PARTNER_ASSIGNMENT_STATUSES,
  TRADE_PARTNER_CONTRACT_STATUSES,
  type CreateTradePartnerAssignmentInput,
  type TradePartnerAssignmentStatus,
  type TradePartnerContractStatus,
  type UpdateTradePartnerAssignmentInput,
} from "./types";

export type ValidationResult<T> = {
  ok: boolean;
  errors: string[];
  normalized: T;
};

function cleanText(value: string | null | undefined) {
  return (value || "").trim();
}

function toNullableText(value: string | null | undefined) {
  const cleaned = cleanText(value);
  return cleaned.length > 0 ? cleaned : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidAssignmentStatus(value: string): value is TradePartnerAssignmentStatus {
  return TRADE_PARTNER_ASSIGNMENT_STATUSES.includes(value as TradePartnerAssignmentStatus);
}

function isValidContractStatus(value: string): value is TradePartnerContractStatus {
  return TRADE_PARTNER_CONTRACT_STATUSES.includes(value as TradePartnerContractStatus);
}

export function normalizeCreateTradePartnerAssignmentInput(input: CreateTradePartnerAssignmentInput): CreateTradePartnerAssignmentInput {
  return {
    projectId: cleanText(input.projectId),
    vendorId: cleanText(input.vendorId),
    tradeName: cleanText(input.tradeName),
    scopeOfWork: toNullableText(input.scopeOfWork),
    primaryContactName: toNullableText(input.primaryContactName),
    primaryContactPhone: toNullableText(input.primaryContactPhone),
    primaryContactEmail: toNullableText(input.primaryContactEmail),
    contractStatus: (input.contractStatus || "draft").trim().toLowerCase() as TradePartnerContractStatus,
    contractAmount: input.contractAmount ?? null,
    paymentTerms: toNullableText(input.paymentTerms),
    retainagePercent: input.retainagePercent ?? null,
    startDate: toNullableText(input.startDate),
    targetCompletionDate: toNullableText(input.targetCompletionDate),
    crewSize: input.crewSize ?? null,
    assignmentStatus: (input.assignmentStatus || "active").trim().toLowerCase() as TradePartnerAssignmentStatus,
    notes: toNullableText(input.notes),
  };
}

export function validateCreateTradePartnerAssignmentInput(input: CreateTradePartnerAssignmentInput): ValidationResult<CreateTradePartnerAssignmentInput> {
  const normalized = normalizeCreateTradePartnerAssignmentInput(input);
  const errors: string[] = [];

  if (!normalized.projectId) {
    errors.push("projectId is required.");
  }

  if (!normalized.vendorId) {
    errors.push("vendorId is required.");
  }

  if (!normalized.tradeName) {
    errors.push("tradeName is required.");
  }

  if (!normalized.contractStatus || !isValidContractStatus(normalized.contractStatus)) {
    errors.push("contractStatus is invalid.");
  }

  if (!normalized.assignmentStatus || !isValidAssignmentStatus(normalized.assignmentStatus)) {
    errors.push("assignmentStatus is invalid.");
  }

  const contractAmount = normalized.contractAmount ?? null;
  if (contractAmount !== null && (!isFiniteNumber(contractAmount) || contractAmount < 0)) {
    errors.push("contractAmount must be a non-negative number.");
  }

  const retainagePercent = normalized.retainagePercent ?? null;
  if (retainagePercent !== null && (!isFiniteNumber(retainagePercent) || retainagePercent < 0 || retainagePercent > 100)) {
    errors.push("retainagePercent must be between 0 and 100.");
  }

  const crewSize = normalized.crewSize ?? null;
  if (crewSize !== null && (!Number.isInteger(crewSize) || crewSize < 0)) {
    errors.push("crewSize must be a non-negative integer.");
  }

  if (normalized.startDate && normalized.targetCompletionDate && normalized.targetCompletionDate < normalized.startDate) {
    errors.push("targetCompletionDate cannot be before startDate.");
  }

  if (normalized.primaryContactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.primaryContactEmail)) {
    errors.push("primaryContactEmail is invalid.");
  }

  return {
    ok: errors.length === 0,
    errors,
    normalized,
  };
}

export function normalizeUpdateTradePartnerAssignmentInput(input: UpdateTradePartnerAssignmentInput): UpdateTradePartnerAssignmentInput {
  return {
    tradeName: input.tradeName !== undefined ? cleanText(input.tradeName) : undefined,
    scopeOfWork: input.scopeOfWork !== undefined ? toNullableText(input.scopeOfWork) : undefined,
    primaryContactName: input.primaryContactName !== undefined ? toNullableText(input.primaryContactName) : undefined,
    primaryContactPhone: input.primaryContactPhone !== undefined ? toNullableText(input.primaryContactPhone) : undefined,
    primaryContactEmail: input.primaryContactEmail !== undefined ? toNullableText(input.primaryContactEmail) : undefined,
    contractStatus: input.contractStatus !== undefined ? input.contractStatus.trim().toLowerCase() as TradePartnerContractStatus : undefined,
    contractAmount: input.contractAmount ?? (input.contractAmount === null ? null : undefined),
    paymentTerms: input.paymentTerms !== undefined ? toNullableText(input.paymentTerms) : undefined,
    retainagePercent: input.retainagePercent ?? (input.retainagePercent === null ? null : undefined),
    startDate: input.startDate !== undefined ? toNullableText(input.startDate) : undefined,
    targetCompletionDate: input.targetCompletionDate !== undefined ? toNullableText(input.targetCompletionDate) : undefined,
    crewSize: input.crewSize ?? (input.crewSize === null ? null : undefined),
    notes: input.notes !== undefined ? toNullableText(input.notes) : undefined,
  };
}

export function validateUpdateTradePartnerAssignmentInput(input: UpdateTradePartnerAssignmentInput): ValidationResult<UpdateTradePartnerAssignmentInput> {
  const normalized = normalizeUpdateTradePartnerAssignmentInput(input);
  const errors: string[] = [];

  if (normalized.tradeName !== undefined && !normalized.tradeName) {
    errors.push("tradeName cannot be blank.");
  }

  if (normalized.contractStatus !== undefined && !isValidContractStatus(normalized.contractStatus)) {
    errors.push("contractStatus is invalid.");
  }

  if (normalized.contractAmount !== undefined && normalized.contractAmount !== null && (!isFiniteNumber(normalized.contractAmount) || normalized.contractAmount < 0)) {
    errors.push("contractAmount must be a non-negative number.");
  }

  if (normalized.retainagePercent !== undefined && normalized.retainagePercent !== null && (!isFiniteNumber(normalized.retainagePercent) || normalized.retainagePercent < 0 || normalized.retainagePercent > 100)) {
    errors.push("retainagePercent must be between 0 and 100.");
  }

  if (normalized.crewSize !== undefined && normalized.crewSize !== null && (!Number.isInteger(normalized.crewSize) || normalized.crewSize < 0)) {
    errors.push("crewSize must be a non-negative integer.");
  }

  if (normalized.primaryContactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.primaryContactEmail)) {
    errors.push("primaryContactEmail is invalid.");
  }

  if (normalized.startDate && normalized.targetCompletionDate && normalized.targetCompletionDate < normalized.startDate) {
    errors.push("targetCompletionDate cannot be before startDate.");
  }

  return {
    ok: errors.length === 0,
    errors,
    normalized,
  };
}

export function canTransitionAssignmentStatus(
  currentStatus: TradePartnerAssignmentStatus,
  nextStatus: TradePartnerAssignmentStatus,
) {
  const transitions: Record<TradePartnerAssignmentStatus, TradePartnerAssignmentStatus[]> = {
    active: ["active", "inactive", "archived"],
    inactive: ["inactive", "active", "archived"],
    archived: ["archived"],
  };

  return transitions[currentStatus]?.includes(nextStatus) || false;
}
