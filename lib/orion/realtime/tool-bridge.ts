"use client";

import type { OrionRealtimeServerEvent, OrionRealtimeToolExecutionResult } from "./types";

export const ORION_REALTIME_CONFIRM_TOOL = "bos_confirm_pending_action";
export const ORION_REALTIME_RESEARCH_TOOL = "orion_web_research";

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

async function executeRealtimeResearch(call: OrionRealtimeFunctionCall): Promise<OrionRealtimeToolExecutionResult> {
  const query = typeof call.params.query === "string" ? call.params.query.trim() : "";
  const response = await fetch("/api/orion/realtime/research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  const payload = await response.json() as Partial<OrionRealtimeToolExecutionResult> & { error?: string };
  return {
    ok: Boolean(response.ok && payload.ok),
    statusCategory: payload.statusCategory || (response.ok ? "completed" : "intelligence_error"),
    userMessage: payload.userMessage || payload.error || "Orion research could not be completed.",
    href: null,
    confirmationRequired: false,
    confirmationToken: null,
  };
}

export async function executeOrionRealtimeTool(
  call: OrionRealtimeFunctionCall,
  options?: { confirmationTranscript?: string | null },
): Promise<OrionRealtimeToolExecutionResult> {
  if (call.toolName === ORION_REALTIME_RESEARCH_TOOL) {
    return executeRealtimeResearch(call);
  }

  const response = await fetch("/api/orion/realtime/tool", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      toolName: call.toolName,
      params: call.params,
      confirmationTranscript: options?.confirmationTranscript || undefined,
    }),
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

export function extractOrionRealtimeUserTranscript(event: OrionRealtimeServerEvent) {
  if (event.type !== "conversation.item.input_audio_transcription.completed") return null;
  return typeof event.transcript === "string" && event.transcript.trim() ? event.transcript.trim() : null;
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
