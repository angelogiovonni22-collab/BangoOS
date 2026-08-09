"use client";

import type { OrionRealtimeServerEvent, OrionRealtimeToolExecutionResult } from "./types";

export type OrionRealtimeFunctionCall = {
  callId: string;
  toolName: string;
  params: Record<string, unknown>;
};

function parseParams(argumentsJson: string) {
  try {
    const parsed = JSON.parse(argumentsJson) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const wrapper = parsed as { params?: unknown };
    if (!wrapper.params || typeof wrapper.params !== "object" || Array.isArray(wrapper.params)) return {};
    return wrapper.params as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function extractOrionRealtimeFunctionCall(event: OrionRealtimeServerEvent): OrionRealtimeFunctionCall | null {
  if (event.type !== "response.function_call_arguments.done") return null;

  const callId = typeof event.call_id === "string" ? event.call_id : null;
  const toolName = typeof event.name === "string" ? event.name : null;
  const argumentsJson = typeof event.arguments === "string" ? event.arguments : "{}";
  if (!callId || !toolName) return null;

  return {
    callId,
    toolName,
    params: parseParams(argumentsJson),
  };
}

export async function executeOrionRealtimeTool(call: OrionRealtimeFunctionCall): Promise<OrionRealtimeToolExecutionResult> {
  const response = await fetch("/api/orion/realtime/tool", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toolName: call.toolName, params: call.params }),
  });

  const payload = await response.json() as Partial<OrionRealtimeToolExecutionResult> & { error?: string };
  return {
    ok: Boolean(response.ok && payload.ok),
    statusCategory: payload.statusCategory || (response.ok ? "completed" : "command_execution_failed"),
    commandId: payload.commandId,
    userMessage: payload.userMessage || payload.error || "The BOS action could not be completed.",
    href: payload.href || null,
    confirmationRequired: Boolean(payload.confirmationRequired),
    confirmationToken: typeof payload.confirmationToken === "string" ? payload.confirmationToken : null,
  };
}

export function buildOrionRealtimeFunctionOutputEvent(callId: string, result: OrionRealtimeToolExecutionResult) {
  return {
    type: "conversation.item.create",
    item: {
      type: "function_call_output",
      call_id: callId,
      output: JSON.stringify({
        ok: result.ok,
        statusCategory: result.statusCategory,
        commandId: result.commandId || null,
        message: result.userMessage,
        href: result.href || null,
        confirmationRequired: Boolean(result.confirmationRequired),
        confirmationToken: result.confirmationToken || null,
      }),
    },
  };
}

export function buildOrionRealtimeContinueResponseEvent() {
  return { type: "response.create" };
}
