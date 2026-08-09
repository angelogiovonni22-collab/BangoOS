"use client";

import type { OrionRealtimeServerEvent, OrionRealtimeToolExecutionResult } from "./types";

export const ORION_REALTIME_CONFIRM_TOOL = "bos_confirm_pending_action";
export const ORION_REALTIME_RESEARCH_TOOL = "orion_web_research";
export const ORION_REALTIME_CONTEXT_TOOL = "orion_current_context";
export const ORION_REALTIME_RESOLVE_ENTITY_TOOL = "orion_resolve_entity";

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

function routeEntityId(pathname: string, entity: string) {
  const match = pathname.match(new RegExp(`^/${entity}/([^/?#]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function currentBosContext(): OrionRealtimeToolExecutionResult {
  if (typeof window === "undefined") {
    return {
      ok: false,
      statusCategory: "context_unavailable",
      userMessage: "Current BOS page context is unavailable.",
    };
  }

  const url = new URL(window.location.href);
  const pathname = url.pathname || "/dashboard";
  const details = {
    pathname,
    projectId: url.searchParams.get("projectId") || routeEntityId(pathname, "projects"),
    customerId: url.searchParams.get("customerId") || routeEntityId(pathname, "customers"),
    estimateId: url.searchParams.get("estimateId") || routeEntityId(pathname, "estimates"),
    invoiceId: url.searchParams.get("invoiceId") || routeEntityId(pathname, "invoices"),
    employeeId: url.searchParams.get("employeeId") || routeEntityId(pathname, "employees"),
    crewId: url.searchParams.get("crewId") || routeEntityId(pathname, "crews"),
  };

  return {
    ok: true,
    statusCategory: "context_resolved",
    userMessage: "Current BOS page context resolved.",
    details,
  };
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
    details: payload.details,
  };
}

async function executeEntityResolution(call: OrionRealtimeFunctionCall): Promise<OrionRealtimeToolExecutionResult> {
  const entityType = typeof call.params.entityType === "string" ? call.params.entityType.trim() : "";
  const phrase = typeof call.params.phrase === "string" ? call.params.phrase.trim() : "";
  const response = await fetch("/api/orion/realtime/resolve-entity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entityType, phrase }),
  });

  const payload = await response.json() as Partial<OrionRealtimeToolExecutionResult> & { error?: string };
  return {
    ok: Boolean(response.ok && payload.ok),
    statusCategory: payload.statusCategory || (response.ok ? "resolved" : "entity_resolution_failed"),
    userMessage: payload.userMessage || payload.error || "Orion could not resolve that BOS record.",
    href: null,
    confirmationRequired: false,
    confirmationToken: null,
    details: payload.details,
  };
}

export async function executeOrionRealtimeTool(
  call: OrionRealtimeFunctionCall,
  options?: { confirmationTranscript?: string | null },
): Promise<OrionRealtimeToolExecutionResult> {
  if (call.toolName === ORION_REALTIME_CONTEXT_TOOL) {
    return currentBosContext();
  }

  if (call.toolName === ORION_REALTIME_RESEARCH_TOOL) {
    return executeRealtimeResearch(call);
  }

  if (call.toolName === ORION_REALTIME_RESOLVE_ENTITY_TOOL) {
    return executeEntityResolution(call);
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
    details: payload.details,
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
        details: result.details ?? null,
      }),
    },
  };
}

export function buildOrionRealtimeContinueResponseEvent() {
  return { type: "response.create" };
}
