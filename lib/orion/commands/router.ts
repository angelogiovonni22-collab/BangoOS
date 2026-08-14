import { createHash } from "node:crypto";
import { createOrionCommandRegistry } from "./registry";
import { recordOrionCommandHistory } from "./history";
import type {
  OrionCommandDefinition,
  OrionCommandDependencies,
  OrionCommandExecutionContext,
  OrionCommandExecutionOutput,
  OrionCommandExecutionResult,
  OrionCommandPermission,
  OrionCommandRequest,
} from "./types";

function computeCorrelationId(request: OrionCommandRequest) {
  if (request.correlationId && request.correlationId.trim()) {
    return request.correlationId.trim();
  }

  return `cmd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function computeIdempotencyKey(request: OrionCommandRequest, commandId: string) {
  if (request.idempotencyKey && request.idempotencyKey.trim()) {
    return request.idempotencyKey.trim();
  }

  const payload = JSON.stringify({
    commandId,
    companyId: request.companyContext.companyId,
    actorProfileId: request.userContext.actorProfileId,
    params: request.params || {},
  });

  const digest = createHash("sha256").update(payload).digest("hex").slice(0, 24);
  return `cmd:${commandId}:${digest}`;
}

function resolveCommand(request: OrionCommandRequest) {
  const registry = createOrionCommandRegistry();

  if (request.commandId?.trim()) {
    return registry.getById(request.commandId.trim());
  }

  if (request.commandName?.trim()) {
    return registry.getByName(request.commandName.trim());
  }

  return null;
}

function normalizePermission(role: OrionCommandRequest["userContext"]["role"] | string): OrionCommandPermission {
  const normalized = role.trim().toLowerCase();
  switch (normalized) {
    case "owner":
      return "owner";
    case "admin":
    case "administrator":
      return "administrator";
    case "operations_manager":
      return "operations_manager";
    case "accountant":
      return "accountant";
    case "project_manager":
      return "project_manager";
    case "superintendent":
      return "superintendent";
    default:
      return "employee";
  }
}

function hasPermission(command: OrionCommandDefinition, role: OrionCommandRequest["userContext"]["role"] | string) {
  const normalizedRole = normalizePermission(role);
  return command.requiredPermissions.includes(normalizedRole);
}

function isCommandConfirmed(request: OrionCommandRequest) {
  if (typeof request.confirmation === "boolean") {
    return request.confirmation;
  }

  return request.confirmation?.confirmed === true;
}

function toExecutionResult(params: {
  success: boolean;
  status: OrionCommandExecutionResult["status"];
  commandId: string;
  commandName: string;
  correlationId: string;
  failure: string | null;
  durationMs: number;
  entityType: OrionCommandExecutionResult["entityType"];
  entityId: OrionCommandExecutionResult["entityId"];
  createdEntityIds?: string[];
  updatedEntityIds?: string[];
  publishedEventIds?: string[];
  warnings?: string[];
  requiresConfirmation?: boolean;
  confirmationSummary?: string | null;
  href?: string | null;
  userMessage: string;
  retryable?: boolean;
  idempotentReplay?: boolean;
  validationErrors?: string[];
  details?: Record<string, unknown>;
}): OrionCommandExecutionResult {
  return {
    success: params.success,
    status: params.status,
    commandExecutionId: null,
    entityType: params.entityType,
    entityId: params.entityId,
    createdEntityIds: params.createdEntityIds || [],
    updatedEntityIds: params.updatedEntityIds || [],
    publishedEventIds: params.publishedEventIds || [],
    requiresConfirmation: params.requiresConfirmation || false,
    confirmationSummary: params.confirmationSummary || null,
    href: params.href || null,
    userMessage: params.userMessage,
    retryable: params.retryable || false,
    idempotentReplay: params.idempotentReplay || false,
    failure: params.failure,
    warnings: params.warnings || [],
    entityCreated: null,
    entityUpdated: null,
    publishedEvent: null,
    commandHistoryEventId: null,
    deepLink: params.href || null,
    durationMs: params.durationMs,
    correlationId: params.correlationId,
    commandId: params.commandId,
    commandName: params.commandName,
    details: params.details || {},
    validationErrors: params.validationErrors || [],
  };
}

function normalizeExecutionOutput(output: OrionCommandExecutionOutput, command: OrionCommandDefinition) {
  const entityCreated = output.entityCreated || null;
  const entityUpdated = output.entityUpdated || null;
  const entityType = output.entityType || entityCreated?.type || entityUpdated?.type || command.entityType;
  const entityId = output.entityId || entityCreated?.id || entityUpdated?.id || null;
  const publishedEventIds = output.publishedEventIds || (output.publishedEvent ? [output.publishedEvent] : []);
  const href = output.href || output.deepLink || null;

  return {
    status: output.status || "completed",
    entityType,
    entityId,
    createdEntityIds: output.createdEntityIds || (entityCreated ? [entityCreated.id] : []),
    updatedEntityIds: output.updatedEntityIds || (entityUpdated ? [entityUpdated.id] : []),
    publishedEventIds,
    href,
    userMessage: output.userMessage || "Command executed successfully.",
    retryable: output.retryable || false,
    requiresConfirmation: output.requiresConfirmation || false,
    confirmationSummary: output.confirmationSummary || null,
    warnings: output.warnings || [],
    details: output.details || {},
    entityCreated,
    entityUpdated,
    publishedEvent: output.publishedEvent || null,
    deepLink: output.deepLink || null,
  };
}

export function createOrionCommandRouter(deps: OrionCommandDependencies) {
  const registry = createOrionCommandRegistry();

  return {
    listCommands: registry.list,

    async executeCommand(request: OrionCommandRequest): Promise<OrionCommandExecutionResult> {
      const startedAt = Date.now();
      const correlationId = computeCorrelationId(request);

      const command = resolveCommand(request);
      if (!command) {
        const durationMs = Date.now() - startedAt;
        return toExecutionResult({
          success: false,
          status: "failed",
          commandId: request.commandId || "unknown",
          commandName: request.commandName || "unknown",
          correlationId,
          durationMs,
          failure: "Command was not found in registry.",
          entityType: null,
          entityId: null,
          userMessage: "Command was not found in registry.",
        });
      }

      const executionOrigin = request.executionContext?.origin || "user";
      const automationRuleId = request.executionContext?.automationRuleId || null;
      const automationRunId = request.executionContext?.automationRunId || null;

      if (!hasPermission(command, request.userContext.role)) {
        const durationMs = Date.now() - startedAt;
        const failure = `Permission denied for ${command.id}.`;
        const historyId = await recordOrionCommandHistory(deps.supabase, {
          commandId: command.id,
          commandName: command.name,
          referenceId: null,
          companyId: request.companyContext.companyId,
          actorProfileId: request.userContext.actorProfileId,
          occurredAt: new Date().toISOString(),
          durationMs,
          success: false,
          failure,
          validationErrors: [],
          correlationId,
          idempotencyKey: computeIdempotencyKey(request, command.id),
          payload: {
            command_description: command.description,
            permission_required: command.requiredPermissions,
            execution_origin: executionOrigin,
            automation_rule_id: automationRuleId,
            automation_run_id: automationRunId,
          },
        });

        return {
          ...toExecutionResult({
            success: false,
            status: "rejected",
            commandId: command.id,
            commandName: command.name,
            correlationId,
            durationMs,
            failure,
            entityType: command.entityType,
            entityId: null,
            userMessage: failure,
          }),
          commandHistoryEventId: historyId,
        };
      }

      if (command.confirmationLevel === "REQUIRED" && !isCommandConfirmed(request)) {
        const durationMs = Date.now() - startedAt;
        const failure = `Confirmation is required before running ${command.id}.`;
        const historyId = await recordOrionCommandHistory(deps.supabase, {
          commandId: command.id,
          commandName: command.name,
          referenceId: null,
          companyId: request.companyContext.companyId,
          actorProfileId: request.userContext.actorProfileId,
          occurredAt: new Date().toISOString(),
          durationMs,
          success: false,
          failure,
          validationErrors: [],
          correlationId,
          idempotencyKey: computeIdempotencyKey(request, command.id),
          payload: {
            command_description: command.description,
            confirmation_required: true,
            execution_origin: executionOrigin,
            automation_rule_id: automationRuleId,
            automation_run_id: automationRunId,
          },
        });

        return {
          ...toExecutionResult({
            success: false,
            status: "rejected",
            commandId: command.id,
            commandName: command.name,
            correlationId,
            durationMs,
            failure,
            entityType: command.entityType,
            entityId: null,
            userMessage: failure,
            requiresConfirmation: true,
            confirmationSummary: typeof request.confirmation === "object"
              ? request.confirmation.summary || null
              : null,
          }),
          commandHistoryEventId: historyId,
        };
      }

      const validation = command.validate(request.params);
      if (!validation.ok || !validation.normalizedParams) {
        const durationMs = Date.now() - startedAt;
        const failure = "Command validation failed.";
        const historyId = await recordOrionCommandHistory(deps.supabase, {
          commandId: command.id,
          commandName: command.name,
          referenceId: null,
          companyId: request.companyContext.companyId,
          actorProfileId: request.userContext.actorProfileId,
          occurredAt: new Date().toISOString(),
          durationMs,
          success: false,
          failure,
          validationErrors: validation.errors,
          correlationId,
          idempotencyKey: computeIdempotencyKey(request, command.id),
          payload: {
            command_description: command.description,
            execution_origin: executionOrigin,
            automation_rule_id: automationRuleId,
            automation_run_id: automationRunId,
          },
        });

        return {
          ...toExecutionResult({
            success: false,
            status: "failed",
            commandId: command.id,
            commandName: command.name,
            correlationId,
            durationMs,
            failure,
            entityType: command.entityType,
            entityId: null,
            userMessage: failure,
            validationErrors: validation.errors,
          }),
          commandHistoryEventId: historyId,
        };
      }

      const executionContext: OrionCommandExecutionContext = {
        request,
        commandId: command.id,
        commandName: command.name,
        companyId: request.companyContext.companyId,
        actorProfileId: request.userContext.actorProfileId,
        correlationId,
        idempotencyKey: computeIdempotencyKey(request, command.id),
      };

      try {
        const output = await command.execute(validation.normalizedParams, executionContext, deps);
        const normalized = normalizeExecutionOutput(output, command);
        const durationMs = Date.now() - startedAt;

        const historyId = await recordOrionCommandHistory(deps.supabase, {
          commandId: command.id,
          commandName: command.name,
          referenceId: normalized.entityId,
          companyId: executionContext.companyId,
          actorProfileId: executionContext.actorProfileId,
          occurredAt: new Date().toISOString(),
          durationMs,
          success: normalized.status !== "failed" && normalized.status !== "rejected",
          failure: normalized.status === "failed" || normalized.status === "rejected"
            ? normalized.userMessage
            : null,
          validationErrors: [],
          correlationId: executionContext.correlationId,
          idempotencyKey: executionContext.idempotencyKey,
          payload: {
            command_description: command.description,
            command_status: normalized.status,
            published_events: normalized.publishedEventIds,
            deep_link: normalized.href,
            undo_capable: command.undoCapable,
            execution_origin: executionOrigin,
            automation_rule_id: automationRuleId,
            automation_run_id: automationRunId,
          },
        });

        return {
          success: normalized.status === "completed" || normalized.status === "unsupported",
          status: normalized.status,
          commandExecutionId: null,
          entityType: normalized.entityType,
          entityId: normalized.entityId,
          createdEntityIds: normalized.createdEntityIds,
          updatedEntityIds: normalized.updatedEntityIds,
          publishedEventIds: normalized.publishedEventIds,
          requiresConfirmation: normalized.requiresConfirmation,
          confirmationSummary: normalized.confirmationSummary,
          href: normalized.href,
          userMessage: normalized.userMessage,
          retryable: normalized.retryable,
          idempotentReplay: false,
          failure: normalized.status === "failed" || normalized.status === "rejected"
            ? normalized.userMessage
            : null,
          warnings: normalized.warnings,
          entityCreated: normalized.entityCreated,
          entityUpdated: normalized.entityUpdated,
          publishedEvent: normalized.publishedEvent,
          commandHistoryEventId: historyId,
          deepLink: normalized.deepLink,
          durationMs,
          correlationId,
          commandId: command.id,
          commandName: command.name,
          details: normalized.details,
          validationErrors: [],
        };
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        const failure = error instanceof Error ? error.message : "Command execution failed.";
        const historyId = await recordOrionCommandHistory(deps.supabase, {
          commandId: command.id,
          commandName: command.name,
          referenceId: null,
          companyId: executionContext.companyId,
          actorProfileId: executionContext.actorProfileId,
          occurredAt: new Date().toISOString(),
          durationMs,
          success: false,
          failure,
          validationErrors: [],
          correlationId: executionContext.correlationId,
          idempotencyKey: executionContext.idempotencyKey,
          payload: {
            command_description: command.description,
            execution_origin: executionOrigin,
            automation_rule_id: automationRuleId,
            automation_run_id: automationRunId,
          },
        });

        return {
          ...toExecutionResult({
            success: false,
            status: "failed",
            commandId: command.id,
            commandName: command.name,
            correlationId,
            durationMs,
            failure,
            entityType: command.entityType,
            entityId: null,
            userMessage: failure,
            retryable: true,
          }),
          commandHistoryEventId: historyId,
        };
      }
    },
  };
}
