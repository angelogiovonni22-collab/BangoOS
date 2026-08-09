import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./voice-session.ts", import.meta.url), "utf8");

assert.match(
  source,
  /recognition\.continuous\s*=\s*true/,
  "Orion recognition must stay continuous so a command can immediately follow the wake phrase.",
);

assert.doesNotMatch(
  source,
  /recognition\.continuous\s*=\s*false/,
  "Orion must not force the wake phrase and command into separate recognition sessions.",
);

console.log("Orion zero-pause wake contract passed.");
