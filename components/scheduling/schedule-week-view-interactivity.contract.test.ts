import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve(process.cwd(), "components/scheduling/schedule-week-view.tsx"), "utf8");

const checks: Array<[boolean, string]> = [
  [source.includes('groupBy === "crew" ? "Crew"'), "crew grouping header is human readable"],
  [source.includes('metadata?.crewOptions.find'), "crew UUIDs resolve through scheduling crew options"],
  [source.includes('"+ Add assignment"'), "empty crew/date slots expose quick add"],
  [source.includes('createSchedulingService'), "quick add reuses the existing scheduling service"],
  [source.includes('schedulingService.createAssignment(draft)'), "quick add saves through the canonical assignment service"],
  [source.includes('hover:border-[var(--color-brand-500)]'), "hover treatment is scoped to individual empty slots"],
  [!source.includes('return assignment.assignedCrewIds.join(", ")'), "raw crew UUIDs are not rendered as group labels"],
];

let failures = 0;
for (const [condition, label] of checks) {
  if (condition) console.log(`+ ${label}`);
  else {
    failures += 1;
    console.error(`x ${label}`);
  }
}

if (failures > 0) process.exitCode = 1;
