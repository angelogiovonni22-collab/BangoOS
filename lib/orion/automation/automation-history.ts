import type { OrionEventRecord } from "@/lib/orion/events";
import { createSupabaseOrionEventPublisher } from "@/lib/orion/events";
import type { OrionAutomationStepHistory } from "./automation-types";
import type { OrionAutomationExecutionContext } from "./automation-types";

export type OrionAutomationHistory = {
  startRun: (params: {
    ruleId: string;
    runId: string;
    event: OrionEventRecord;
  }) => Promise<{ shouldRun: boolean }>;
  completeRun: (params: {
    ruleId: string;
    runId: string;
    event: OrionEventRecord;
    steps: OrionAutomationStepHistory[];
  }) => Promise<void>;
  failRun: (params: {
    ruleId: string;
    runId: string;
    event: OrionEventRecord;
    stepId: string;
    reason: string;
    steps: OrionAutomationStepHistory[];
  }) => Promise<void>;
  startStep: (params: {
    ruleId: string;
    runId: string;
    stepId: string;
    event: OrionEventRecord;
    startedAt: string;
  }) => Promise<void>;
  completeStep: (params: {
    ruleId: string;
    runId: string;
    stepId: string;
    event: OrionEventRecord;
    startedAt: string;
    completedAt: string;
    success: boolean;
    details: string | null;
    output?: Record<string, unknown>;
    retryCount: number;
  }) => Promise<void>;
};

export function createOrionAutomationHistory(context: OrionAutomationExecutionContext): OrionAutomationHistory {
  const publisher = createSupabaseOrionEventPublisher(context.supabase);

  return {
    async startRun(params) {
      const result = await publisher.publishEvent({
        company_id: params.event.company_id,
        actor_profile_id: params.event.actor_profile_id,
        event_type: "automation.rule.started",
        aggregate_type: "workflow",
        aggregate_id: params.runId,
        source_module: "automation",
        correlation_id: params.event.event_id,
        causation_id: params.event.event_id,
        idempotency_key: `automation:run:start:${params.ruleId}:${params.event.event_id}`,
        payload: {
          rule_id: params.ruleId,
          run_id: params.runId,
          trigger_event_id: params.event.event_id,
          trigger_event_type: params.event.event_type,
          started_at: context.now().toISOString(),
        },
      });

      return { shouldRun: !result.idempotent };
    },

    async completeRun(params) {
      await publisher.publishEvent({
        company_id: params.event.company_id,
        actor_profile_id: params.event.actor_profile_id,
        event_type: "automation.rule.completed",
        aggregate_type: "workflow",
        aggregate_id: params.runId,
        source_module: "automation",
        correlation_id: params.event.event_id,
        causation_id: params.event.event_id,
        idempotency_key: `automation:run:completed:${params.ruleId}:${params.event.event_id}`,
        payload: {
          rule_id: params.ruleId,
          run_id: params.runId,
          trigger_event_id: params.event.event_id,
          trigger_event_type: params.event.event_type,
          completed_at: context.now().toISOString(),
          steps: params.steps.map((step) => ({
            step_id: step.stepId,
            success: step.success,
            duration_ms: step.durationMs,
            retry_count: step.retryCount,
          })),
        },
      });
    },

    async failRun(params) {
      await publisher.publishEvent({
        company_id: params.event.company_id,
        actor_profile_id: params.event.actor_profile_id,
        event_type: "automation.failed",
        aggregate_type: "workflow",
        aggregate_id: params.runId,
        source_module: "automation",
        correlation_id: params.event.event_id,
        causation_id: params.event.event_id,
        idempotency_key: `automation:run:failed:${params.ruleId}:${params.event.event_id}`,
        payload: {
          rule_id: params.ruleId,
          run_id: params.runId,
          failed_step: params.stepId,
          reason: params.reason,
          trigger_event_id: params.event.event_id,
          trigger_event_type: params.event.event_type,
          failed_at: context.now().toISOString(),
          steps: params.steps.map((step) => ({
            step_id: step.stepId,
            success: step.success,
            duration_ms: step.durationMs,
            retry_count: step.retryCount,
          })),
        },
      });
    },

    async startStep(params) {
      await publisher.publishEvent({
        company_id: params.event.company_id,
        actor_profile_id: params.event.actor_profile_id,
        event_type: "automation.step.started",
        aggregate_type: "workflow",
        aggregate_id: params.runId,
        source_module: "automation",
        correlation_id: params.event.event_id,
        causation_id: params.event.event_id,
        idempotency_key: `automation:step:start:${params.ruleId}:${params.event.event_id}:${params.stepId}`,
        payload: {
          rule_id: params.ruleId,
          run_id: params.runId,
          step_id: params.stepId,
          started_at: params.startedAt,
          trigger_event_id: params.event.event_id,
        },
      });
    },

    async completeStep(params) {
      await publisher.publishEvent({
        company_id: params.event.company_id,
        actor_profile_id: params.event.actor_profile_id,
        event_type: params.success ? "automation.step.completed" : "automation.step.failed",
        aggregate_type: "workflow",
        aggregate_id: params.runId,
        source_module: "automation",
        correlation_id: params.event.event_id,
        causation_id: params.event.event_id,
        idempotency_key: `automation:step:end:${params.ruleId}:${params.event.event_id}:${params.stepId}`,
        payload: {
          rule_id: params.ruleId,
          run_id: params.runId,
          step_id: params.stepId,
          started_at: params.startedAt,
          completed_at: params.completedAt,
          duration_ms: new Date(params.completedAt).getTime() - new Date(params.startedAt).getTime(),
          success: params.success,
          details: params.details,
          retry_count: params.retryCount,
          trigger_event_id: params.event.event_id,
          output: params.output || {},
        },
      });
    },
  };
}
