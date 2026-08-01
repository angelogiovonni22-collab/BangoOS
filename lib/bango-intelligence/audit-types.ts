/**
 * Audit types for Bango Intelligence request logging.
 *
 * For Phase 8B: captured server-side only. No database table required.
 * No sensitive prompts, secrets, or full customer data are logged.
 */

export type BangoAIAuditResult = {
  /** Stable UUID for this request */
  requestId: string;
  userId: string;
  companyId: string;
  projectId: string | null;
  roleId: string;
  roleVersion: string;
  requestType: string;
  capabilitySet: string[];
  approvalLevel: string;
  evidenceCount: number;
  provider: string;
  model: string;
  timestamp: string;
  success: boolean;
  /** Latency in milliseconds */
  latencyMs: number;
  /** True when the deterministic briefing was returned instead of AI */
  fallbackUsed: boolean;
  /** Token usage when available from the provider */
  tokensInput: number | null;
  tokensOutput: number | null;
  /** Short failure reason — no sensitive detail */
  failureReason: string | null;
};

/**
 * Logs an audit result server-side. For Phase 8B this is console-only.
 * No PII, no full prompts, no secrets are emitted.
 */
export function logAuditResult(result: BangoAIAuditResult): void {
  const {
    requestId,
    userId,
    companyId,
    projectId,
    roleId,
    roleVersion,
    requestType,
    capabilitySet,
    approvalLevel,
    evidenceCount,
    provider,
    model,
    success,
    latencyMs,
    fallbackUsed,
    tokensInput,
    tokensOutput,
    failureReason,
  } = result;

  console.log(
    JSON.stringify({
      level: success ? "info" : "warn",
      event: "bango_ai_request",
      requestId,
      userId,
      companyId,
      projectId,
      roleId,
      roleVersion,
      requestType,
      capabilitySet,
      approvalLevel,
      evidenceCount,
      provider,
      model,
      success,
      latencyMs,
      fallbackUsed,
      tokensInput,
      tokensOutput,
      failureReason: failureReason ?? undefined,
    }),
  );
}
