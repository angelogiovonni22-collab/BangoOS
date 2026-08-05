import type { OrionVoiceCaptureMode } from "./voice-types";

export type OrionVoiceControllerState = {
  captureMode: OrionVoiceCaptureMode;
  handsFreeEnabled: boolean;
  wakeListening: boolean;
};

export function nextWakeListeningState(state: OrionVoiceControllerState) {
  if (!state.handsFreeEnabled) {
    return false;
  }

  return state.captureMode === "tap_to_listen" ? state.wakeListening : false;
}
