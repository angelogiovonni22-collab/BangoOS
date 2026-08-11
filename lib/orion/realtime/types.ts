export type OrionRealtimeConnectionState =
  | "idle"
  | "requesting_microphone"
  | "connecting"
  | "connected"
  | "closing"
  | "closed"
  | "error";

export type OrionRealtimeSessionOptions = {
  voice?: string | null;
};

export type OrionRealtimeServerEvent = {
  type?: string;
  [key: string]: unknown;
};

export type OrionRealtimeToolExecutionResult = {
  ok: boolean;
  statusCategory: string;
  commandId?: string;
  userMessage: string;
  href?: string | null;
  confirmationRequired?: boolean;
  confirmationToken?: string | null;
  details?: unknown;
};

export type OrionRealtimeClientCallbacks = {
  onStateChange?: (state: OrionRealtimeConnectionState) => void;
  onEvent?: (event: OrionRealtimeServerEvent) => void;
  onToolResult?: (result: OrionRealtimeToolExecutionResult) => void | Promise<void>;
  onError?: (error: Error) => void;
};
