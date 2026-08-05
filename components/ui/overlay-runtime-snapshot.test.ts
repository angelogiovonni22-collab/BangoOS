import assert from "node:assert/strict";
import {
  getOverlayStackServerSnapshot,
  getOverlayStackSnapshot,
  registerOverlay,
  resetOverlayRuntimeForTests,
  unregisterOverlay,
} from "./overlay-runtime";

function testServerSnapshotReferenceIsStable() {
  resetOverlayRuntimeForTests();

  const first = getOverlayStackServerSnapshot();
  const second = getOverlayStackServerSnapshot();

  assert.equal(first, second, "server snapshot reference stays stable across repeated reads");
  assert.equal(first.length, 0, "server snapshot starts empty");
}

function testClientSnapshotReferenceChangesOnlyOnMutation() {
  resetOverlayRuntimeForTests();

  const initial = getOverlayStackSnapshot();
  const repeated = getOverlayStackSnapshot();
  assert.equal(initial, repeated, "client snapshot reference is stable between reads");

  registerOverlay("overlay-a");
  const afterRegister = getOverlayStackSnapshot();
  assert.notEqual(initial, afterRegister, "client snapshot changes when stack mutates");

  const afterRegisterRepeated = getOverlayStackSnapshot();
  assert.equal(afterRegister, afterRegisterRepeated, "client snapshot remains stable after mutation until next change");

  unregisterOverlay("overlay-a");
  const afterUnregister = getOverlayStackSnapshot();
  assert.notEqual(afterRegister, afterUnregister, "client snapshot changes again when stack mutates back");

  const serverSnapshot = getOverlayStackServerSnapshot();
  assert.equal(afterUnregister, serverSnapshot, "empty client snapshot reuses shared immutable empty snapshot");
}

function main() {
  testServerSnapshotReferenceIsStable();
  testClientSnapshotReferenceChangesOnlyOnMutation();
  console.log("Overlay runtime snapshot contracts passed.");
}

main();
