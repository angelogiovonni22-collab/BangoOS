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

export type OrionRealtimeClientCallbacks = {
  onStateChange?: (state: OrionRealtimeConnectionState) => void;
  onEvent?: (event: OrionRealtimeServerEvent) => void;
  onError?: (error: Error) => void;
};
