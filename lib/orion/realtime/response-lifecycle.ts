export type OrionRealtimeEventSender = (event: Record<string, unknown>) => boolean;

/**
 * Coordinates follow-up inference for the default Realtime conversation.
 * Only one response may write to that conversation at a time, so tool
 * continuations wait for the current response's terminal event.
 */
export class OrionRealtimeResponseLifecycle {
  private readonly send: OrionRealtimeEventSender;
  private responseActive = false;
  private continuationPending = false;
  private continuationSequence = 0;

  constructor(send: OrionRealtimeEventSender) {
    this.send = send;
  }

  onResponseCreated() {
    this.responseActive = true;
  }

  onResponseDone() {
    this.responseActive = false;
    this.flushContinuation();
  }

  requestContinuation() {
    this.continuationPending = true;
    this.flushContinuation();
  }

  reset() {
    this.responseActive = false;
    this.continuationPending = false;
  }

  private flushContinuation() {
    if (this.responseActive || !this.continuationPending) return;

    const eventId = `orion-tool-continuation-${++this.continuationSequence}`;
    const sent = this.send({ type: "response.create", event_id: eventId });
    if (sent) {
      this.continuationPending = false;
      // Reserve the default conversation immediately. response.created arrives
      // asynchronously, and another tool result must not create a second response.
      this.responseActive = true;
    }
  }
}
