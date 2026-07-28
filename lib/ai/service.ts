import type {
  AIActionDefinition,
  AIActionName,
  AIAuditEvent,
  AIContext,
} from "./types";

export type AIQuestionInput = {
  prompt: string;
  context: AIContext;
};

export type AIProposalInput = {
  action: AIActionName;
  context: AIContext;
  summary: string;
};

export type AIExecutionInput = {
  action: AIActionName;
  context: AIContext;
  confirmationToken: string;
};

export type AIAskResult = {
  answer: string;
  auditEvent?: AIAuditEvent;
};

export type AIProposedAction = {
  action: AIActionDefinition;
  summary: string;
  auditEvent?: AIAuditEvent;
};

export type AIExecutionResult = {
  status: "not_configured";
  message: string;
  auditEvent?: AIAuditEvent;
};

export interface AIService {
  buildContext(input: Partial<AIContext> & Pick<AIContext, "userId" | "companyId" | "route">): AIContext;
  ask(input: AIQuestionInput): Promise<AIAskResult>;
  proposeAction(input: AIProposalInput): Promise<AIProposedAction>;
  executeApprovedAction(input: AIExecutionInput): Promise<AIExecutionResult>;
}

export function createAIService(): AIService {
  const notConfigured = (): never => {
    throw new Error("AI provider not configured");
  };

  return {
    buildContext(input) {
      return {
        userId: input.userId,
        companyId: input.companyId,
        customerId: input.customerId ?? null,
        projectId: input.projectId ?? null,
        route: input.route,
        userRole: input.userRole ?? null,
      };
    },
    async ask() {
      throw notConfigured();
    },
    async proposeAction() {
      throw notConfigured();
    },
    async executeApprovedAction() {
      throw notConfigured();
    },
  };
}