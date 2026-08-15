import { createOrionCommandRegistry } from "@/lib/orion/commands";
import type { OrionCommandDefinition, OrionCommandPermission } from "@/lib/orion/commands";

export type OrionBosToolDescriptor = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  metadata: {
    commandId: string;
    entityType: string;
    confirmationLevel: OrionCommandDefinition["confirmationLevel"];
    requiredPermissions: OrionCommandPermission[];
    coverageStatus: OrionCommandDefinition["coverage"]["status"];
    inputSchema: string;
  };
};

export type OrionCommandCoverageSummary = {
  total: number;
  executable: number;
  navigationOnly: number;
  unsupported: number;
  unsupportedCommands: Array<{
    commandId: string;
    reason: string;
    missingDependency: string | null;
  }>;
};

function toToolName(commandId: string) {
  return `bos_${commandId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function isFastCreateCommand(commandId: string) {
  return commandId === "customer.create"
    || commandId === "project.create"
    || commandId === "estimate.create"
    || commandId === "invoice.create";
}

function toToolDescription(command: OrionCommandDefinition) {
  const confirmation = command.confirmationLevel === "NONE"
    ? "No confirmation is normally required."
    : command.confirmationLevel === "REVIEW"
      ? "Review the action with the user before execution when the workflow requires it."
      : "Explicit user confirmation is required before execution.";
  const fastPath = isFastCreateCommand(command.id)
    ? " Fast path: use this directly when the user wants the record created or saved now; do not navigate to a form first unless they asked to see or fill the form. Human-readable customer/project/estimate names are accepted in the documented alias fields and resolved company-safely."
    : "";

  return `${command.description} BOS command: ${command.id}. Expected input: ${command.inputSchema}.${fastPath} ${confirmation} Never bypass BOS validation, permissions, or confirmation controls.`;
}

function wrapParams(params: Record<string, unknown>, required: string[] = []) {
  return {
    type: "object",
    properties: {
      params: {
        type: "object",
        properties: params,
        required,
        additionalProperties: true,
      },
    },
    required: ["params"],
    additionalProperties: false,
  };
}

const TEXT = { type: "string" } as const;
const NUMBER_OR_TEXT = { type: ["number", "string"] } as const;
const UNIT = { type: "string", enum: ["each", "hour", "day", "week", "square_foot", "linear_foot", "cubic_yard", "lump_sum"] } as const;

function estimateLineItemSchema() {
  return {
    type: "object",
    properties: {
      id: TEXT,
      sortOrder: { type: "number" },
      itemCode: TEXT,
      category: { type: "string", enum: ["labor", "materials", "equipment", "subcontractors", "general_conditions", "permits_fees", "other"] },
      description: TEXT,
      quantity: NUMBER_OR_TEXT,
      unit: UNIT,
      unitCost: NUMBER_OR_TEXT,
      markupPercent: NUMBER_OR_TEXT,
      notes: TEXT,
    },
    required: ["description"],
    additionalProperties: true,
  };
}

function invoiceLineItemSchema() {
  return {
    type: "object",
    properties: {
      id: TEXT,
      sortOrder: { type: "number" },
      description: TEXT,
      quantity: NUMBER_OR_TEXT,
      unit: UNIT,
      rate: NUMBER_OR_TEXT,
      notes: TEXT,
    },
    required: ["description"],
    additionalProperties: true,
  };
}

function optimizedToolParameters(command: OrionCommandDefinition): Record<string, unknown> | null {
  if (command.id === "customer.create") {
    return wrapParams({
      customerType: { type: "string", enum: ["residential", "commercial"] },
      firstName: TEXT,
      lastName: TEXT,
      companyName: TEXT,
      email: TEXT,
      phone: TEXT,
      addressLine1: TEXT,
      addressLine2: TEXT,
      city: TEXT,
      state: TEXT,
      postalCode: TEXT,
      notes: TEXT,
    }, ["firstName", "lastName", "email", "phone", "addressLine1", "city", "state", "postalCode"]);
  }

  if (command.id === "project.create") {
    return wrapParams({
      name: TEXT,
      customerId: TEXT,
      customerName: { type: "string", description: "Human-readable customer name/company. Use when customerId is not already known; BOS resolves it safely." },
      projectNumber: TEXT,
      projectType: TEXT,
      status: TEXT,
      description: TEXT,
      addressLine1: TEXT,
      addressLine2: TEXT,
      city: TEXT,
      state: TEXT,
      postalCode: TEXT,
      estimatedStartDate: TEXT,
      estimatedEndDate: TEXT,
      estimatedCost: { type: "number" },
      contractAmount: { type: "number" },
    }, ["name"]);
  }

  if (command.id === "estimate.create") {
    return wrapParams({
      estimateId: TEXT,
      values: {
        type: "object",
        properties: {
          title: TEXT,
          estimateNumber: TEXT,
          customerId: TEXT,
          customerName: { type: "string", description: "Human-readable customer name/company. BOS resolves a unique company-scoped match." },
          projectId: TEXT,
          projectName: { type: "string", description: "Human-readable project name. BOS resolves a unique company-scoped match." },
          issueDate: TEXT,
          expirationDate: TEXT,
          preparedBy: TEXT,
          status: { type: "string", enum: ["draft", "internal_review", "sent", "viewed", "approved", "rejected", "expired", "archived", "ready", "revision_requested", "void", "superseded"] },
          description: TEXT,
          discountType: { type: "string", enum: ["none", "percentage", "fixed"] },
          discountValue: NUMBER_OR_TEXT,
          taxRatePercent: NUMBER_OR_TEXT,
          additionalFee: NUMBER_OR_TEXT,
          internalNotes: TEXT,
          customerNotes: TEXT,
          scopeInclusions: TEXT,
          scopeExclusions: TEXT,
          terms: TEXT,
          paymentTerms: TEXT,
        },
        additionalProperties: true,
      },
      lineItems: { type: "array", items: estimateLineItemSchema() },
    }, ["values", "lineItems"]);
  }

  if (command.id === "invoice.create") {
    return wrapParams({
      invoiceId: TEXT,
      values: {
        type: "object",
        properties: {
          title: TEXT,
          invoiceNumber: TEXT,
          customerId: TEXT,
          customerName: { type: "string", description: "Human-readable customer name/company. BOS resolves a unique company-scoped match." },
          projectId: TEXT,
          projectName: { type: "string", description: "Human-readable project name. BOS resolves a unique company-scoped match." },
          estimateId: TEXT,
          estimateName: { type: "string", description: "Human-readable estimate title or number. BOS resolves a unique company-scoped match." },
          preparedBy: TEXT,
          issueDate: TEXT,
          dueDate: TEXT,
          status: { type: "string", enum: ["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "void"] },
          description: TEXT,
          discountType: { type: "string", enum: ["none", "percentage", "fixed"] },
          discountValue: NUMBER_OR_TEXT,
          taxRatePercent: NUMBER_OR_TEXT,
          additionalFee: NUMBER_OR_TEXT,
          notes: TEXT,
          paymentTerms: TEXT,
        },
        additionalProperties: true,
      },
      lineItems: { type: "array", items: invoiceLineItemSchema() },
    }, ["values", "lineItems"]);
  }

  return null;
}

function genericToolParameters(command: OrionCommandDefinition) {
  return {
    type: "object",
    properties: {
      params: {
        type: "object",
        additionalProperties: true,
        description: `Parameters for ${command.id}. Contract: ${command.inputSchema}`,
      },
    },
    required: ["params"],
    additionalProperties: false,
  };
}

export function buildUniversalBosToolCatalog(options?: { includeNavigation?: boolean }) {
  const includeNavigation = options?.includeNavigation ?? true;
  const commands = createOrionCommandRegistry().list();

  return commands
    .filter((command) => command.coverage.status !== "unsupported")
    .filter((command) => includeNavigation || command.coverage.status !== "navigation_only")
    .map<OrionBosToolDescriptor>((command) => ({
      type: "function",
      name: toToolName(command.id),
      description: toToolDescription(command),
      parameters: optimizedToolParameters(command) || genericToolParameters(command),
      metadata: {
        commandId: command.id,
        entityType: command.entityType,
        confirmationLevel: command.confirmationLevel,
        requiredPermissions: [...command.requiredPermissions],
        coverageStatus: command.coverage.status,
        inputSchema: command.inputSchema,
      },
    }));
}

export function getUniversalBosCommandByToolName(toolName: string) {
  const descriptor = buildUniversalBosToolCatalog().find((tool) => tool.name === toolName);
  if (!descriptor) {
    return null;
  }

  return createOrionCommandRegistry().getById(descriptor.metadata.commandId);
}

export function summarizeUniversalBosCoverage(): OrionCommandCoverageSummary {
  const commands = createOrionCommandRegistry().list();
  const unsupported = commands.filter((command) => command.coverage.status === "unsupported");

  return {
    total: commands.length,
    executable: commands.filter((command) => command.coverage.status === "implemented").length,
    navigationOnly: commands.filter((command) => command.coverage.status === "navigation_only").length,
    unsupported: unsupported.length,
    unsupportedCommands: unsupported.map((command) => ({
      commandId: command.id,
      reason: command.coverage.reason || "Not implemented.",
      missingDependency: command.coverage.missingDependency || null,
    })),
  };
}
