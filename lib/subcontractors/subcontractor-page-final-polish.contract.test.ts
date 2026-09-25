import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync("components/projects/workspace/project-trade-partners-workspace.tsx", "utf8");
const actions = readFileSync("components/projects/workspace/subcontractor-contract-actions.tsx", "utf8");
const tabs = readFileSync("components/projects/workspace/project-tabs.tsx", "utf8");

test("subcontractor workspace uses clear signed and mobilization language", () => {
  assert.match(workspace, /Contract Signed · Awaiting Mobilization Clearance/);
  assert.match(workspace, /Current Trade Partner Crew/);
  assert.doesNotMatch(workspace, /Additional Project Details/);
});

test("signed agreement action is rendered as a real button-style action", () => {
  assert.match(actions, /getButtonClassName/);
  assert.match(actions, /View Agreement/);
});

test("desktop project tabs wrap instead of clipping off-screen", () => {
  assert.match(tabs, /xl:flex-wrap xl:overflow-visible/);
});

test("generic All trade label is presented as General Remodeling", () => {
  assert.match(workspace, /displayTradeName/);
  assert.match(workspace, /General Remodeling/);
});
