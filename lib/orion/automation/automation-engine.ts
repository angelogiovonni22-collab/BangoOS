import type { OrionEventRecord } from "@/lib/orion/events";
import { createOrionAutomationHistory, type OrionAutomationHistory } from "./automation-history";
import type {
  OrionAutomationExecutionContext,
  OrionAutomationRule,
  OrionAutomationRunResult,
  OrionAutomationStepHistory,
} from "./automation-types";

export type OrionAutomationEngine = {
  executeRule: (rule: OrionAutomationRule, event: OrionEventRecord) => Promise<OrionAutomationRunResult>;
};

export function createAutomationEngine(
  context: OrionAutomationExecutionContext,
  options?: { history?: OrionAutomationHistory },
): OrionAutomationEngine {
  const history = options?.history || createOrionAutomationHistory(context);

  return {
    async executeRule(rule, event) {
      const runId = `${rule.id}:${event.event_id}`;
      const started = await history.startRun({
        ruleId: rule.id,
        runId,
        event,
      });

      if (!started.shouldRun) {
        return {
          ruleId: rule.id,
          runId,
          triggeredByEventId: event.event_id,
          status: "skipped",
          steps: [],
          failureMessage: null,
        };
      }

      const steps: OrionAutomationStepHistory[] = [];

      for (let index = 0; index < rule.actions.length; index += 1) {
        const action = rule.actions[index];
        const startedAt = context.now().toISOString();
        await history.startStep({
          ruleId: rule.id,
          runId,
          stepId: action.id,
          event,
          startedAt,
        });

        try {
          const result = await action.execute({
            event,
            companyId: event.company_id,
            runId,
            stepIndex: index,
            context,
          });

          const completedAt = context.now().toISOString();
          const stepRecord: OrionAutomationStepHistory = {
            ruleId: rule.id,
            stepId: action.id,
            startedAt,
            completedAt,
            durationMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
            success: true,
            failureMessage: null,
            retryCount: 0,
            relatedEventId: event.event_id,
          };
          steps.push(stepRecord);

          await history.completeStep({
            ruleId: rule.id,
            runId,
            stepId: action.id,
            event,
            startedAt,
            completedAt,
            success: true,
            details: result.details || null,
            output: result.output,
            retryCount: 0,
          });

          if (result.status === "skipped") {
            continue;
          }
        } catch (error) {
          const completedAt = context.now().toISOString();
          const reason = error instanceof Error ? error.message : "Automation step failed.";

          const stepRecord: OrionAutomationStepHistory = {
            ruleId: rule.id,
            stepId: action.id,
            startedAt,
            completedAt,
            durationMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
            success: false,
            failureMessage: reason,
            retryCount: 0,
            relatedEventId: event.event_id,
          };
          steps.push(stepRecord);

          await history.completeStep({
            ruleId: rule.id,
            runId,
            stepId: action.id,
            event,
            startedAt,
            completedAt,
            success: false,
            details: reason,
            retryCount: 0,
          });

          await history.failRun({
            ruleId: rule.id,
            runId,
            event,
            stepId: action.id,
            reason,
            steps,
          });

          return {
            ruleId: rule.id,
            runId,
            triggeredByEventId: event.event_id,
            status: "failed",
            steps,
            failureMessage: reason,
          };
        }
      }

      await history.completeRun({
        ruleId: rule.id,
        runId,
        event,
        steps,
      });

      return {
        ruleId: rule.id,
        runId,
        triggeredByEventId: event.event_id,
        status: "completed",
        steps,
        failureMessage: null,
      };
    },
  };
}
