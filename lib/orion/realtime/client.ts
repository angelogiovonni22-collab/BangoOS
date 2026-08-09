"use client";

import type {
  OrionRealtimeClientCallbacks,
  OrionRealtimeConnectionState,
  OrionRealtimeServerEvent,
  OrionRealtimeSessionOptions,
} from "./types";

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

export class OrionRealtimeClient {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private microphoneStream: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private callbacks: OrionRealtimeClientCallbacks;

  constructor(callbacks: OrionRealtimeClientCallbacks = {}) {
    this.callbacks = callbacks;
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
        if (parsed) this.callbacks.onEvent?.(parsed);
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
