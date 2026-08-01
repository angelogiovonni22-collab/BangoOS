import { applyCapabilityPolicyToContext } from "./capability-policy";
import { buildBangoBusinessContext, type BuildBangoBusinessContextResult } from "./context-builder";
import { buildEvidenceFromContext, filterEvidenceByCapabilities } from "./evidence";
import { createReasoningContext, type BangoReasoningContext } from "./reasoning-context";
import { getRoleDefinition, isRoleSupported } from "./role-registry";
import { InMemoryMemoryProvider } from "../memory/memory-provider";
import { buildMemoryBriefingLineup, retrieveMemoryContext, type MemoryProvider } from "../memory/memory-service";
import { createClient } from "@/lib/supabase/server";
import {
  buildDeterministicLearningContext,
  SupabaseLearningProvider,
} from "../learning";
import type {
  BangoBusinessContext,
  BangoCapabilityId,
  BangoCoreRequest,
  BangoRoleDefinition,
} from "./context-types";

if (typeof window !== "undefined") {
  throw new Error("bango-intelligence/core/request-builder must run on the server.");
}

export type BangoProviderRequest = {
  requestId: string;
  role: BangoRoleDefinition;
  businessContext: BangoBusinessContext;
  reasoningContext: BangoReasoningContext;
};

export type BuildProviderRequestResult =
  | { ok: true; data: BangoProviderRequest }
  | { ok: false; status: number; error: string };

type RequestBuilderDependencies = {
  contextBuilder?: (
    input: BangoCoreRequest & { requestId: string },
  ) => Promise<BuildBangoBusinessContextResult>;
  memoryProvider?: MemoryProvider;
};

export async function buildBangoProviderRequest(
  input: BangoCoreRequest & { requestId: string },
  deps?: RequestBuilderDependencies,
): Promise<BuildProviderRequestResult> {
  if (!isRoleSupported(input.roleId)) {
    return { ok: false, status: 400, error: "Unsupported AI role." };
  }

  const role = getRoleDefinition(input.roleId);
  if (!role.enabled) {
    return { ok: false, status: 403, error: "This AI role is currently disabled." };
  }

  if (!role.supportedRequestTypes.includes(input.requestType)) {
    return { ok: false, status: 400, error: "Unsupported request type for this role." };
  }

  for (const scope of role.requiredContextScopes) {
    if (scope === "project" && !input.projectId) {
      return { ok: false, status: 400, error: "projectId is required for this role." };
    }
    if (scope === "customer" && !input.customerId) {
      return { ok: false, status: 400, error: "customerId is required for this role." };
    }
    if (scope === "phase" && !input.phaseId) {
      return { ok: false, status: 400, error: "phaseId is required for this role." };
    }
    if (scope === "task" && !input.taskId) {
      return { ok: false, status: 400, error: "taskId is required for this role." };
    }
  }

  const contextBuilder = deps?.contextBuilder ?? buildBangoBusinessContext;
  const contextResult = await contextBuilder(input);
  if (!contextResult.ok) {
    return contextResult;
  }

  const capabilityBoundContext = applyCapabilityPolicyToContext(contextResult.context, role);
  const rawEvidence = buildEvidenceFromContext(capabilityBoundContext);
  const approvedEvidence = filterEvidenceByCapabilities(rawEvidence, role);
  const memoryProvider = deps?.memoryProvider ?? new InMemoryMemoryProvider();
  let memoryContext: Parameters<typeof createReasoningContext>[3] | undefined;
  let learningContext: Parameters<typeof createReasoningContext>[4] | undefined;

  try {
    const memoryResult = await retrieveMemoryContext({
      provider: memoryProvider,
      companyId: capabilityBoundContext.identity.companyId,
      role,
      allowedCapabilities: capabilityBoundContext.permissions.allowedCapabilities,
      requestType: input.requestType,
      projectId: capabilityBoundContext.scope.projectId,
      customerId: capabilityBoundContext.scope.customerId,
      phaseId: capabilityBoundContext.scope.phaseId,
      taskId: capabilityBoundContext.scope.taskId,
      maxResults: 12,
    });

    memoryContext = {
      summary: memoryResult.summary,
      rankedEvidence: memoryResult.rankedEvidence,
      projectDNA: memoryResult.projectDNA,
      companyDNA: memoryResult.companyDNA,
      customerProfileSummary: memoryResult.customerProfileSummary,
      recommendationHistory: memoryResult.recommendationHistory,
      briefing: buildMemoryBriefingLineup(memoryResult),
    };
  } catch {
    memoryContext = undefined;
  }

  if (canBuildLearningContext(capabilityBoundContext.permissions.allowedCapabilities)) {
    try {
      const supabase = await createClient();
      if (supabase) {
        const learningProvider = new SupabaseLearningProvider(supabase);
        const learningResult = await buildDeterministicLearningContext(learningProvider, {
          companyId: capabilityBoundContext.identity.companyId,
          projectId: capabilityBoundContext.scope.projectId,
          customerId: capabilityBoundContext.scope.customerId,
        });

        const hasSufficientConfidence = learningResult.briefingLines.length > 0;

        if (hasSufficientConfidence) {
          learningContext = {
            snapshot: learningResult.snapshot,
            briefingLines: learningResult.briefingLines,
            companyDNA: learningResult.companyDNA,
            projectDNA: learningResult.projectDNA,
            customerDNA: learningResult.customerDNA,
          };
        } else {
          capabilityBoundContext.limitations.push(
            "Deterministic learning context skipped due to insufficient confidence.",
          );
        }
      } else {
        capabilityBoundContext.limitations.push(
          "Deterministic learning context unavailable because Supabase server client could not be created.",
        );
      }
    } catch {
      learningContext = undefined;
      capabilityBoundContext.limitations.push("Deterministic learning context unavailable.");
    }
  } else {
    capabilityBoundContext.limitations.push(
      "Deterministic learning context unavailable for current role capabilities.",
    );
  }

  capabilityBoundContext.evidence = approvedEvidence;

  const reasoningContext = createReasoningContext(
    role,
    capabilityBoundContext,
    approvedEvidence,
    memoryContext,
    learningContext,
  );

  return {
    ok: true,
    data: {
      requestId: input.requestId,
      role,
      businessContext: capabilityBoundContext,
      reasoningContext,
    },
  };
}

function canBuildLearningContext(allowedCapabilities: BangoCapabilityId[]): boolean {
  const required: BangoCapabilityId[] = [
    "read_project",
    "read_tasks",
    "read_financials",
    "read_customers",
  ];

  return required.every((capability) => allowedCapabilities.includes(capability));
}
