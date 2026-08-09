import { createOrionCommandRegistry } from "@/lib/orion/commands";
import type { OrionCommandDefinition, OrionCommandPermission } from "@/lib/orion/commands";

export type OrionBosToolDescriptor = {
  type: "function";
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: {
      params: {
        type: "object";
        additionalProperties: true;
        description: string;
      };
    };
    required: ["params"];
    additionalProperties: false;
  };
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

function toToolDescription(command: OrionCommandDefinition) {
  const confirmation = command.confirmationLevel === "NONE"
    ? "No confirmation is normally required."
    : command.confirmationLevel === "REVIEW"
      ? "Review the action with the user before execution when the workflow requires it."
      : "Explicit user confirmation is required before execution.";

  return `${command.description} BOS command: ${command.id}. Expected input: ${command.inputSchema}. ${confirmation} Never bypass BOS validation, permissions, or confirmation controls.`;
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
      parameters: {
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
      },
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
