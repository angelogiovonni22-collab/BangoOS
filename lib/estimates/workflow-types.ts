export type EstimateVerificationResult = "verified" | "unverified" | "failed" | "not_available";

export type EstimateApprovalInput = {
  companyId: string;
  estimateId: string;
  actorProfileId: string | null;
  typedName: string;
  consentAccepted: boolean;
  idempotencyKey: string;
  publicToken?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  verificationResult?: EstimateVerificationResult;
  metadata?: Record<string, unknown>;
};

export type EstimateDeclineInput = {
  companyId: string;
  estimateId: string;
  actorProfileId: string | null;
  idempotencyKey: string;
  reason: string;
  publicToken?: string;
  metadata?: Record<string, unknown>;
};

export type EstimateRequestChangesInput = {
  companyId: string;
  estimateId: string;
  actorProfileId: string | null;
  idempotencyKey: string;
  reason: string;
  publicToken?: string;
  metadata?: Record<string, unknown>;
};

export type GeneratePublicTokenInput = {
  companyId: string;
  estimateId: string;
  actorProfileId: string | null;
  ttlHours?: number;
  metadata?: Record<string, unknown>;
};

export type ValidatePublicTokenInput = {
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type GenerateAgreementSnapshotInput = {
  companyId: string;
  estimateId: string;
  actorProfileId: string | null;
  includeSourceFields?: boolean;
};

export type StoreSignatureInput = {
  companyId: string;
  estimateId: string;
  agreementVersionId: string;
  estimateVersionNumber: number;
  typedName: string;
  consentAccepted: boolean;
  verificationResult: EstimateVerificationResult;
  idempotencyKey: string;
  publicTokenId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};

export type StoreAcceptanceInput = {
  companyId: string;
  estimateId: string;
  actorProfileId: string | null;
  eventType: "approved" | "declined" | "request_changes" | "sent" | "viewed" | "followup_due" | "converted";
  actorType: "customer" | "internal" | "system";
  idempotencyKey?: string;
  signatureId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

export type ConvertEstimateToProjectInput = {
  companyId: string;
  estimateId: string;
  actorProfileId: string;
  idempotencyKey: string;
  createDepositInvoice?: boolean;
};

export type CreateDepositInvoiceInput = {
  companyId: string;
  estimateId: string;
  actorProfileId: string;
  idempotencyKey: string;
};

export type EstimateConversionResult = {
  conversionId: string;
  projectId: string | null;
  projectNumber: string | null;
  depositInvoiceId: string | null;
  status: string;
  idempotent: boolean;
};

export type EstimateWorkflowService = {
  approveEstimate: (input: EstimateApprovalInput) => Promise<{ signatureId: string; acceptanceEventId: string; agreementVersionId: string }>;
  declineEstimate: (input: EstimateDeclineInput) => Promise<{ acceptanceEventId: string }>;
  requestChanges: (input: EstimateRequestChangesInput) => Promise<{ acceptanceEventId: string }>;
  generatePublicToken: (input: GeneratePublicTokenInput) => Promise<{ token: string; tokenId: string; expiresAt: string }>;
  validatePublicToken: (input: ValidatePublicTokenInput) => Promise<{ isValid: boolean; tokenId: string | null; companyId: string | null; estimateId: string | null; expiresAt: string | null; failureReason: string | null }>;
  generateAgreementSnapshot: (input: GenerateAgreementSnapshotInput) => Promise<{ agreementVersionId: string; versionNumber: number; agreementHash: string; snapshot: Record<string, unknown> }>;
  storeSignature: (input: StoreSignatureInput) => Promise<{ signatureId: string }>;
  storeAcceptance: (input: StoreAcceptanceInput) => Promise<{ acceptanceEventId: string }>;
  convertEstimateToProject: (input: ConvertEstimateToProjectInput) => Promise<EstimateConversionResult>;
  calculateDeposit: (companyId: string, estimateId: string) => Promise<number>;
  createDepositInvoice: (input: CreateDepositInvoiceInput) => Promise<{ invoiceId: string; amount: number; created: boolean }>;
  getConversionResult: (companyId: string, estimateId: string, idempotencyKey?: string) => Promise<EstimateConversionResult | null>;
};
