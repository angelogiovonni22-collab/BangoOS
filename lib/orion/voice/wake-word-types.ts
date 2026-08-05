export type OrionWakeWordVariant = "hey_orion" | "orion" | "okay_orion";

export type OrionWakeWordPolicy = {
  enabled: OrionWakeWordVariant[];
};

export type OrionWakeWordState = "disabled" | "listening" | "detected" | "unsupported";

export type OrionWakeWordDetection = {
  detected: boolean;
  transcript: string;
  cleanedCommand: string;
  matchedVariant: OrionWakeWordVariant | null;
};

export type OrionHandsFreeSettings = {
  enabled: boolean;
  spokenResponses: boolean;
  wakeAcknowledge: "sound" | "spoken";
  autoStopAfterCommand: boolean;
  returnToWakeListening: boolean;
};
