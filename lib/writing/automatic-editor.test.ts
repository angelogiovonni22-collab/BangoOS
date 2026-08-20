import assert from "node:assert/strict";
import { improveNarrativeText } from "./automatic-editor";

assert.equal(improveNarrativeText("install new windows,then frame the wall"), "Install new windows, then frame the wall");
assert.equal(improveNarrativeText("i dont think thats ready"), "I don't think that's ready");
assert.equal(improveNarrativeText("rough-in complete.next phase starts tomorrow"), "Rough-in complete. Next phase starts tomorrow");
assert.equal(improveNarrativeText("crew completed the framing", { finalize: true }), "Crew completed the framing.");
assert.equal(improveNarrativeText("Mike Johnson", { finalize: true }), "Mike Johnson");
assert.equal(improveNarrativeText("https://example.com/a,b"), "https://example.com/a,b");

console.log("+ automatic writing editor fixes narrative text while preserving short labels and verbatim content");
