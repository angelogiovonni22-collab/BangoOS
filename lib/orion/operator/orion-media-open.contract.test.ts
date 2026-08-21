import fs from "node:fs";
import path from "node:path";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed += 1;
    console.log(`  + ${message}`);
  } else {
    failed += 1;
    console.error(`  x FAIL: ${message}`);
  }
}

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

const semantics = read("lib/orion/operator/media-semantics.ts");
const bridge = read("lib/orion/realtime/tool-bridge.ts");
const operator = read("lib/orion/operator/browser.ts");

console.log("\nOrion media/document opening contract");

assert(semantics.includes("ensureOrionMediaSemantics"), "media semantics decorator exists");
assert(semantics.includes("button, a[href]"), "decorator scans visible-style clickable controls instead of inventing file actions");
assert(semantics.includes("DOCUMENT_HREF") && semantics.includes("IMAGE_HREF"), "document and image file links are recognized");
assert(semantics.includes("querySelector<HTMLImageElement>(\"img\")"), "photo-card image controls are recognized even when the button text is generic");
assert(semantics.includes("data-orion-role") && semantics.includes("data-orion-action"), "media controls expose descriptive semantic roles and exact click refs");
assert(semantics.includes("article, tr, li, [role='row']"), "generic preview/open buttons inherit nearby record context for disambiguation");
assert(bridge.includes("ensureOrionMediaSemantics();"), "Realtime UI operator decorates media before every visible operation");
assert(bridge.includes("semanticRole metadata") && bridge.includes("action=click"), "Realtime observation explicitly tells Orion how to open matched media");
assert(operator.includes("semanticRole: element.getAttribute(\"data-orion-role\")"), "UI observation returns media semanticRole metadata to Orion");
assert(operator.includes("if (ref.startsWith(\"action:\"))"), "UI click resolver supports generated media action refs");

console.log(`\nOrion media/document opening results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
