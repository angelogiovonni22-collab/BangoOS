import fs from "node:fs";
import path from "node:path";

const roots = ["app", "components"];
const extensions = new Set([".tsx", ".ts", ".jsx", ".js", ".css"]);
const ignore = new Set(["node_modules", ".next", ".git"]);

const patterns = [
  ["direct-dark-theme-text-token", /text-\[var\(--bos-text-(primary|secondary|muted)\)\]/g],
  ["explicit-white-text", /\btext-white\b/g],
  ["explicit-near-white-text", /\btext-(slate|gray|zinc|neutral|stone)-(50|100|200)\b/g],
  ["light-surface", /\b(bg-white|bg-\[var\(--bos-bg-workspace-(surface|surface-soft|card)\)\]|bg-\[var\(--color-surface-(card|subtle|muted|elevated)\)\])/g],
  ["light-border-with-dark-token", /border-\[var\(--bos-border-light(?:-strong)?\)\]/g],
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignore.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (extensions.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

const files = roots.flatMap((root) => walk(root));
const findings = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const [kind, regex] of patterns) {
      regex.lastIndex = 0;
      if (regex.test(line)) {
        findings.push({ kind, file: file.replaceAll("\\", "/"), line: index + 1, text: line.trim().slice(0, 240) });
      }
    }
  });
}

const byKind = new Map();
for (const finding of findings) {
  const bucket = byKind.get(finding.kind) ?? [];
  bucket.push(finding);
  byKind.set(finding.kind, bucket);
}

console.log(`Scanned ${files.length} source files for BOS contrast risks.`);
for (const [kind, bucket] of byKind.entries()) {
  console.log(`\n## ${kind}: ${bucket.length}`);
  for (const item of bucket) {
    console.log(`${item.file}:${item.line}: ${item.text}`);
  }
}

console.log(`\nTOTAL_FINDINGS=${findings.length}`);
