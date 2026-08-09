"use client";

import type { OrionRealtimeServerEvent } from "./types";

export type OrionRealtimeFunctionCall = {
  callId: string;
  toolName: string;
  params: Record<string, unknown>;
};

export type OrionRealtimeToolExecutionResult = {
  ok: boolean;
  statusCategory: string;
  commandId?: string;
  userMessage: string;
  href?: string | null;
  confirmationRequired?: boolean;
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
  const item = event.item;
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;

  const candidate = item as { type?: unknown; call_id?: unknown; name?: unknown; arguments?: unknown };
  if (candidate.type !== "function_call") return null;
  if (typeof candidate.call_id !== "string" || typeof candidate.name !== "string") return null;

  return {
    callId: candidate.call_id,
    toolName: candidate.name,
    params: parseParams(typeof candidate.arguments === "string" ? candidate.arguments : "{}"),
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
      }),
    },
  };
}

export function buildOrionRealtimeContinueResponseEvent() {
  return { type: "response.create" };
}
