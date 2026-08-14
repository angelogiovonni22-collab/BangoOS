import assert from "node:assert/strict";
import { OrionRealtimeResponseLifecycle } from "./response-lifecycle";

function main() {
  const events: Array<Record<string, unknown>> = [];
  const lifecycle = new OrionRealtimeResponseLifecycle((event) => {
    events.push(event);
    return true;
  });

  lifecycle.onResponseCreated();
  lifecycle.requestContinuation();
  assert.equal(events.length, 0, "continuation waits while the tool-calling response is active");

  lifecycle.requestContinuation();
  lifecycle.onResponseDone();
  assert.equal(events.length, 1, "one response resumes after the active response finishes");
  assert.equal(events[0]?.type, "response.create");
  assert.match(String(events[0]?.event_id), /^orion-tool-continuation-/);

  lifecycle.requestContinuation();
  assert.equal(events.length, 1, "a second continuation cannot overlap the reserved response");
  lifecycle.onResponseDone();
  assert.equal(events.length, 2, "the queued continuation resumes after the reserved response finishes");

  lifecycle.reset();
  lifecycle.requestContinuation();
  assert.equal(events.length, 3, "a reset lifecycle can start a fresh continuation");

  console.log("Orion Realtime response lifecycle: all assertions passed");
}

main();
