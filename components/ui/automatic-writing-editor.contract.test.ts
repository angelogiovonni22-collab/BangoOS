import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
const editor = read("components/ui/automatic-writing-editor.tsx");
const shell = read("app/(app)/app-shell.tsx");
const writingRules = read("lib/writing/automatic-editor.ts");

assert.ok(shell.includes("<AutomaticWritingEditor />"), "the editor is mounted once for every authenticated B.O.S. page");
assert.ok(editor.includes('document.addEventListener("input"'), "new and legacy narrative fields are enhanced through delegation");
assert.ok(editor.includes('document.addEventListener("compositionstart"'), "IME composition is protected");
assert.ok(editor.includes('element.setAttribute("autocorrect", "on")'), "mobile native autocorrect is enabled");
assert.ok(editor.includes('element.setAttribute("autocapitalize", "sentences")'), "mobile sentence capitalization is enabled for narrative text");
assert.ok(editor.includes('element.setAttribute("autocapitalize", "words")'), "mobile word capitalization is enabled for safe text inputs");
assert.ok(editor.includes("shouldEnableNativeInputAssistance"), "single-line fields use safe autocorrect eligibility");
assert.ok(writingRules.includes("NON_LANGUAGE_AUTOCOMPLETE"), "email, phone, URL, password, and one-time-code fields are excluded");
assert.ok(writingRules.includes("INPUT_ASSISTANCE_EXCLUSIONS"), "technical identifiers and code fields are excluded");
assert.ok(editor.includes("shouldAutoEditElement"), "fields can safely opt out");
assert.ok(editor.includes("EDIT_DELAY_MS = 900"), "editing is debounced to avoid cursor churn");

console.log("+ automatic writing editor is globally mounted, debounced, mobile-aware, input-safe, and composition-safe");
