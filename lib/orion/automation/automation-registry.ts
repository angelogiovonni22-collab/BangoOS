import { byDescendingPriority, defineAutomationRule } from "./automation-rule";
import {
  assignProjectStatusStep,
  bootstrapProjectWorkspaceStep,
  createCustomerPortalStep,
  createDepositInvoiceStep,
  createEstimateFollowupReminderStep,
  createProjectFromEstimateStep,
  generateServiceAgreementStep,
  generateWelcomePacketStep,
  seedProjectTimelineStep,
} from "./automation-context";
import type { OrionAutomationRule, OrionAutomationTriggerEvent } from "./automation-types";
import { validateAutomationRule } from "./automation-validation";

export type OrionAutomationRegistry = {
  listAll: () => OrionAutomationRule[];
  listForEvent: (companyId: string, eventType: OrionAutomationTriggerEvent) => OrionAutomationRule[];
};

const SYSTEM_ACTOR = "orion_automation_system";

function nowIso() {
  return new Date().toISOString();
}

export function createAutomationRegistry(): OrionAutomationRegistry {
  const baseRules: OrionAutomationRule[] = [
    defineAutomationRule({
      id: "estimate-approved-workflow",
      companyId: "*",
      enabled: true,
      triggerEvent: "estimate.approved",
      conditions: [
        {
          id: "estimate-approved-event",
          description: "Trigger event must be estimate.approved.",
          async evaluate({ event }) {
            return event.event_type === "estimate.approved";
          },
        },
      ],
      actions: [
        { id: "create-project", description: "Create project", execute: createProjectFromEstimateStep },
        { id: "bootstrap-project-workspace", description: "Seed project phases and workspace context", execute: bootstrapProjectWorkspaceStep },
        { id: "generate-deposit-invoice", description: "Generate deposit invoice", execute: createDepositInvoiceStep },
        { id: "create-customer-portal", description: "Create customer portal", execute: createCustomerPortalStep },
        { id: "generate-service-agreement", description: "Generate service agreement record", execute: generateServiceAgreementStep },
        { id: "generate-welcome-packet", description: "Generate welcome packet", execute: generateWelcomePacketStep },
        { id: "assign-project-status", description: "Assign project status Pre-Construction", execute: assignProjectStatusStep },
        { id: "seed-project-timeline", description: "Create project timeline seed", execute: seedProjectTimelineStep },
      ],
      priority: 100,
      createdBy: SYSTEM_ACTOR,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }),
    defineAutomationRule({
      id: "estimate-viewed-followup",
      companyId: "*",
      enabled: true,
      triggerEvent: "estimate.viewed",
      conditions: [
        {
          id: "estimate-viewed-event",
          description: "Trigger event must be estimate.viewed.",
          async evaluate({ event }) {
            return event.event_type === "estimate.viewed";
          },
        },
      ],
      actions: [
        { id: "create-followup-reminder", description: "Create reminder for stale viewed estimate", execute: createEstimateFollowupReminderStep },
      ],
      priority: 90,
      createdBy: SYSTEM_ACTOR,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }),
  ];

  for (const rule of baseRules) {
    const validation = validateAutomationRule(rule);
    if (!validation.ok) {
      throw new Error(`Invalid automation rule ${rule.id}: ${validation.errors.join(" ")}`);
    }
  }

  return {
    listAll() {
      return [...baseRules].sort(byDescendingPriority);
    },

    listForEvent(companyId, eventType) {
      return baseRules
        .filter((rule) => rule.enabled)
        .filter((rule) => rule.triggerEvent === eventType)
        .filter((rule) => rule.companyId === "*" || rule.companyId === companyId)
        .sort(byDescendingPriority);
    },
  };
}
