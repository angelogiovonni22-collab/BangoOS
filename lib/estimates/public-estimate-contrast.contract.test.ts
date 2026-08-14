import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "app", "contracts", "estimate", "[token]", "page.tsx"),
  "utf8",
);

const requiredContracts = [
  'bg-white p-6 text-slate-950',
  'bg-white text-slate-950',
  'text-slate-800',
  'bg-blue-50 p-6 text-slate-950',
  'bg-white px-4 py-3 text-slate-950',
];

let failed = 0;
for (const contract of requiredContracts) {
  if (source.includes(contract)) {
    console.log(`  + public estimate contrast contract includes ${contract}`);
  } else {
    failed += 1;
    console.error(`  x FAIL: missing public estimate contrast contract ${contract}`);
  }
}

if (failed > 0) {
  process.exitCode = 1;
}
