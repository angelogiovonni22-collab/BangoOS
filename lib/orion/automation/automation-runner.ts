import type { OrionEventRecord } from "@/lib/orion/events";
import { createAutomationExecutionContext, loadLedgerEventById } from "./automation-context";
import { createAutomationEngine } from "./automation-engine";
import { createAutomationRegistry } from "./automation-registry";
import type { OrionAutomationRunResult, OrionAutomationTriggerEvent } from "./automation-types";
import { supportsAutomationTrigger } from "./automation-validation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type OrionAutomationRunner = {
  runForEvent: (event: OrionEventRecord) => Promise<OrionAutomationRunResult[]>;
  runForWorkflowEventId: (eventId: string) => Promise<OrionAutomationRunResult[]>;
};

export function createOrionAutomationRunner(supabase: SupabaseClient<Database>): OrionAutomationRunner {
  const runForEvent: OrionAutomationRunner["runForEvent"] = async (event) => {
    if (!supportsAutomationTrigger(event)) {
      return [];
    }

    const context = createAutomationExecutionContext(supabase);
    context.state.estimateId = event.aggregate_type === "estimate" ? event.aggregate_id : null;
    const registry = createAutomationRegistry();
    const engine = createAutomationEngine(context);
    const triggerEvent = event.event_type as OrionAutomationTriggerEvent;
    const rules = registry.listForEvent(event.company_id, triggerEvent);

    const results: OrionAutomationRunResult[] = [];

    for (const rule of rules) {
      let allowed = true;

      for (const condition of rule.conditions) {
        const pass = await condition.evaluate({
          event,
          companyId: event.company_id,
          context,
        });

        if (!pass) {
          allowed = false;
          break;
        }
      }

      if (!allowed) {
        results.push({
          ruleId: rule.id,
          runId: `${rule.id}:${event.event_id}`,
          triggeredByEventId: event.event_id,
          status: "skipped",
          steps: [],
          failureMessage: null,
        });
        continue;
      }

      const result = await engine.executeRule(rule, event);
      results.push(result);
    }

    return results;
  };

  const runForWorkflowEventId: OrionAutomationRunner["runForWorkflowEventId"] = async (eventId) => {
    const event = await loadLedgerEventById(supabase, eventId);
    if (!event) {
      return [];
    }

    return runForEvent(event);
  };

  return {
    runForEvent,
    runForWorkflowEventId,
  };
}
