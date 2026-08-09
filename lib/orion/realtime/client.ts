"use client";

import {
  buildOrionRealtimeContinueResponseEvent,
  buildOrionRealtimeFunctionOutputEvent,
  executeOrionRealtimeTool,
  extractOrionRealtimeFunctionCall,
  extractOrionRealtimeUserTranscript,
  ORION_REALTIME_CONFIRM_TOOL,
} from "./tool-bridge";
import type {
  OrionRealtimeClientCallbacks,
  OrionRealtimeConnectionState,
  OrionRealtimeServerEvent,
  OrionRealtimeSessionOptions,
} from "./types";

const CONFIRMATION_TRANSCRIPT_MAX_AGE_MS = 8_000;
const CONFIRMATION_TRANSCRIPT_WAIT_MS = 2_000;

function setState(callbacks: OrionRealtimeClientCallbacks, state: OrionRealtimeConnectionState) {
  callbacks.onStateChange?.(state);
}

function parseServerEvent(raw: string): OrionRealtimeServerEvent | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as OrionRealtimeServerEvent;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

export class OrionRealtimeClient {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private microphoneStream: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private callbacks: OrionRealtimeClientCallbacks;
  private activeToolCalls = new Set<string>();
  private lastUserTranscript: { text: string; at: number } | null = null;

  constructor(callbacks: OrionRealtimeClientCallbacks = {}) {
    this.callbacks = callbacks;
  }

  private recentUserTranscript() {
    if (!this.lastUserTranscript) return null;
    if (Date.now() - this.lastUserTranscript.at > CONFIRMATION_TRANSCRIPT_MAX_AGE_MS) return null;
    return this.lastUserTranscript.text;
  }

  private async waitForRecentUserTranscript() {
    const existing = this.recentUserTranscript();
    if (existing) return existing;

    const deadline = Date.now() + CONFIRMATION_TRANSCRIPT_WAIT_MS;
    while (Date.now() < deadline) {
      await sleep(100);
      const transcript = this.recentUserTranscript();
      if (transcript) return transcript;
    }

    return null;
  }

  private async handleServerEvent(event: OrionRealtimeServerEvent) {
    this.callbacks.onEvent?.(event);

    const userTranscript = extractOrionRealtimeUserTranscript(event);
    if (userTranscript) {
      this.lastUserTranscript = { text: userTranscript, at: Date.now() };
    }

    const call = extractOrionRealtimeFunctionCall(event);
    if (!call || this.activeToolCalls.has(call.callId)) return;

    this.activeToolCalls.add(call.callId);
    try {
      const confirmationTranscript = call.toolName === ORION_REALTIME_CONFIRM_TOOL
        ? await this.waitForRecentUserTranscript()
        : null;
      const result = await executeOrionRealtimeTool(call, { confirmationTranscript });
      this.callbacks.onToolResult?.(result);
      this.sendEvent(buildOrionRealtimeFunctionOutputEvent(call.callId, result));
      this.sendEvent(buildOrionRealtimeContinueResponseEvent());
    } catch (error) {
      const resolved = error instanceof Error ? error : new Error("Orion Realtime BOS tool execution failed.");
      this.callbacks.onError?.(resolved);
      this.sendEvent(buildOrionRealtimeFunctionOutputEvent(call.callId, {
        ok: false,
        statusCategory: "command_execution_failed",
        userMessage: resolved.message,
      }));
      this.sendEvent(buildOrionRealtimeContinueResponseEvent());
    } finally {
      this.activeToolCalls.delete(call.callId);
    }
  }

  async connect(options: OrionRealtimeSessionOptions = {}) {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      throw new Error("Orion Realtime voice requires a browser environment.");
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
      throw new Error("This browser does not support the WebRTC features required for Orion Realtime voice.");
    }

    await this.disconnect();

    try {
      setState(this.callbacks, "requesting_microphone");
      const microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.microphoneStream = microphoneStream;

      setState(this.callbacks, "connecting");
      const peerConnection = new RTCPeerConnection();
      this.peerConnection = peerConnection;

      const remoteAudio = document.createElement("audio");
      remoteAudio.autoplay = true;
      remoteAudio.setAttribute("playsinline", "");
      this.remoteAudio = remoteAudio;

      peerConnection.ontrack = (event) => {
        const [stream] = event.streams;
        if (stream && this.remoteAudio) {
          this.remoteAudio.srcObject = stream;
          void this.remoteAudio.play().catch(() => undefined);
        }
      };

      for (const track of microphoneStream.getTracks()) {
        peerConnection.addTrack(track, microphoneStream);
      }

      const dataChannel = peerConnection.createDataChannel("oai-events");
      this.dataChannel = dataChannel;

      dataChannel.onopen = () => setState(this.callbacks, "connected");
      dataChannel.onclose = () => setState(this.callbacks, "closed");
      dataChannel.onerror = () => this.callbacks.onError?.(new Error("Orion Realtime data channel failed."));
      dataChannel.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        const parsed = parseServerEvent(event.data);
        if (parsed) void this.handleServerEvent(parsed);
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      if (!offer.sdp) throw new Error("Unable to create Orion Realtime SDP offer.");

      const response = await fetch("/api/orion/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdp: offer.sdp, voice: options.voice || null }),
      });

      const payload = await response.json() as { ok?: boolean; sdp?: string; error?: string };
      if (!response.ok || !payload.ok || !payload.sdp) {
        throw new Error(payload.error || "Unable to establish Orion Realtime session.");
      }

      await peerConnection.setRemoteDescription({ type: "answer", sdp: payload.sdp });
      return true;
    } catch (error) {
      const resolved = error instanceof Error ? error : new Error("Unable to start Orion Realtime voice.");
      setState(this.callbacks, "error");
      this.callbacks.onError?.(resolved);
      await this.disconnect();
      throw resolved;
    }
  }

  sendEvent(event: Record<string, unknown>) {
    if (!this.dataChannel || this.dataChannel.readyState !== "open") {
      return false;
    }

    this.dataChannel.send(JSON.stringify(event));
    return true;
  }

  async disconnect() {
    if (this.peerConnection || this.microphoneStream || this.dataChannel) {
      setState(this.callbacks, "closing");
    }

    this.activeToolCalls.clear();
    this.lastUserTranscript = null;
    this.dataChannel?.close();
    this.dataChannel = null;

    this.peerConnection?.close();
    this.peerConnection = null;

    for (const track of this.microphoneStream?.getTracks() || []) {
      track.stop();
    }
    this.microphoneStream = null;

    if (this.remoteAudio) {
      this.remoteAudio.pause();
      this.remoteAudio.srcObject = null;
    }
    this.remoteAudio = null;

    setState(this.callbacks, "closed");
  }
}
