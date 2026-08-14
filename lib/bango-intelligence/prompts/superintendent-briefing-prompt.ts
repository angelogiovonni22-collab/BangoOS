/**
 * Superintendent briefing user prompt builder.
 *
 * Converts a compact grounding context into a structured user prompt.
 * The grounding is the ONLY source of facts for the model.
 */

import type { BangoAIRequestType } from "../types";
import type { BangoReasoningContext } from "../core/reasoning-context";

export type BriefingGroundingContext = {
  projectName: string;
  projectStatus: string;
  healthScore: number | null;
  healthStatus: string;
  completionPercent: number;
  activeTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  activePhasesCount: number;
  tasksDueToday: number;
  tasksDueThisWeek: number;
  photosCount: number;
  assignedWorkers: number;
  unassignedTaskCount: number;
  contractAmount: number | null;
  invoicePaid: number;
  invoiceTotal: number;
  budgetVariance: number | null;
  overdueInvoices: number;
  estimatesCount: number;
  changeOrdersCount: number;
  daysUntilDue: number | null;
  documentationPresent: boolean;
  /** Highest risk severity or null */
  highestRisk: string | null;
  /** List of active risks with id, severity, message */
  risks: Array<{ id: string; severity: string; message: string }>;
  /** Briefing state */
  briefingState: string;
  briefingDate: string;
};

/**
 * Builds the user prompt from grounding context and request type.
 * The locale instruction is embedded so the model responds in the right language.
 */
export function buildSuperintendentUserPrompt(
  context: BriefingGroundingContext,
  requestType: BangoAIRequestType,
  locale: string,
): string {
  const localeInstruction = localeToInstruction(locale);
  const requestInstruction = requestTypeToInstruction(requestType, context.projectName);

  return `${localeInstruction}

${requestInstruction}

CONTEXT
${buildGroundingText(context)}`;
}

/**
 * Builds the superintendent prompt from the shared normalized reasoning context.
 */
export function buildSuperintendentUserPromptFromReasoningContext(
  reasoningContext: BangoReasoningContext,
): string {
  if (!reasoningContext.grounding) {
    return `CONTEXT
Project context unavailable.

BUSINESS MEMORY
${reasoningContext.memory.briefing}`;
  }

  const prompt = buildSuperintendentUserPrompt(
    reasoningContext.grounding,
    reasoningContext.request.requestType as BangoAIRequestType,
    reasoningContext.request.locale,
  );

  return `${prompt}

BUSINESS MEMORY
${reasoningContext.memory.briefing}

MEMORY EVIDENCE
${buildMemoryEvidenceText(reasoningContext.memory.rankedEvidence)}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function localeToInstruction(locale: string): string {
  if (locale.startsWith("es")) {
    return "Respond in Spanish (es). Keep project names and proper nouns in their original form.";
  }

  return "Respond in English (en).";
}

function requestTypeToInstruction(
  requestType: BangoAIRequestType,
  projectName: string,
): string {
  switch (requestType) {
    case "narrate_briefing":
      return `Task: Generate a complete superintendent briefing for "${projectName}". Use only the provided context.`;
    case "explain_health":
      return `Task: Explain the current project health for "${projectName}" based on the provided health score, status, and contributing factors.`;
    case "explain_risk":
      return `Task: Explain the active risks for "${projectName}" and recommend specific mitigation actions based solely on the provided risk data.`;
  }
}

function buildGroundingText(ctx: BriefingGroundingContext): string {
  const lines: string[] = [
    `Project: ${ctx.projectName}`,
    `Status: ${ctx.projectStatus}`,
    `Briefing date: ${ctx.briefingDate}`,
    `Briefing state: ${ctx.briefingState}`,
    `Health score: ${ctx.healthScore !== null ? ctx.healthScore : "unavailable"}`,
    `Health status: ${ctx.healthStatus}`,
    `Completion: ${ctx.completionPercent}%`,
    `Active tasks: ${ctx.activeTasks}`,
    `Overdue tasks: ${ctx.overdueTasks}`,
    `Blocked tasks: ${ctx.blockedTasks}`,
    `Tasks due today: ${ctx.tasksDueToday}`,
    `Tasks due this week: ${ctx.tasksDueThisWeek}`,
    `Active phases: ${ctx.activePhasesCount}`,
    `Assigned workers: ${ctx.assignedWorkers}`,
    `Unassigned open tasks: ${ctx.unassignedTaskCount}`,
    `Field photos: ${ctx.photosCount}`,
    `Days until project due: ${ctx.daysUntilDue !== null ? ctx.daysUntilDue : "no target date set"}`,
    `Contract amount: ${ctx.contractAmount !== null ? ctx.contractAmount : "not set"}`,
    `Invoice paid: ${ctx.invoicePaid}`,
    `Invoice total: ${ctx.invoiceTotal}`,
    `Budget variance: ${ctx.budgetVariance !== null ? ctx.budgetVariance : "unavailable"}`,
    `Overdue invoices: ${ctx.overdueInvoices}`,
    `Estimates: ${ctx.estimatesCount}`,
    `Change orders: ${ctx.changeOrdersCount}`,
    `Documentation present: ${ctx.documentationPresent}`,
    `Highest risk severity: ${ctx.highestRisk ?? "none"}`,
  ];

  if (ctx.risks.length > 0) {
    lines.push("\nActive risks:");
    for (const risk of ctx.risks) {
      lines.push(`  [${risk.id}] severity=${risk.severity}: ${risk.message}`);
    }
  } else {
    lines.push("Active risks: none");
  }

  return lines.join("\n");
}

function buildMemoryEvidenceText(evidence: BangoReasoningContext["memory"]["rankedEvidence"]): string {
  if (evidence.length === 0) {
    return "None";
  }

  return evidence
    .map((item) => `[${item.recordId}] ${item.category} (${item.importance}, ${item.confidence}): ${item.summary}`)
    .join("\n");
}
