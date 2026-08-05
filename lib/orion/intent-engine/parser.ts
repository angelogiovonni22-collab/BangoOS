import type { OrionIntentEntityType, OrionIntentKind } from "./types";

const WAKE_PREFIX_PUNCTUATION = "[\\s,.:;!?\\-\\u2013\\u2014]";
const WAKE_WITH_GREETING_PATTERN = new RegExp(`^\\s*(hey|ok(?:ay)?)\\s+orion\\b${WAKE_PREFIX_PUNCTUATION}*`, "i");
const WAKE_ORION_ONLY_PATTERN = new RegExp(`^\\s*orion\\b(${WAKE_PREFIX_PUNCTUATION}+)`, "i");
const COMMAND_START_PATTERN = /^(open|show|go\s+to|take\s+me\s+to|navigate\s+to|find|search|lookup|create|update|assign|complete|archive|send|view|record|generate|convert|start|pause)\b/i;

function collapseWhitespace(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

const INTENT_PATTERNS: Array<{ intent: OrionIntentKind; pattern: RegExp }> = [
  { intent: "inspection_reinspection", pattern: /\breinspection\b|\bre-?inspect/ },
  { intent: "inspection_pass", pattern: /\binspection\b.*\b(pass|passed)\b|\bmark\b.*\binspection\b.*\bpassed\b/ },
  { intent: "inspection_fail", pattern: /\binspection\b.*\b(fail|failed)\b|\bmark\b.*\binspection\b.*\bfailed\b/ },
  { intent: "inspection_schedule", pattern: /\b(schedule|reschedule)\b.*\binspection\b/ },
  { intent: "permit_submit", pattern: /\bsubmit\b.*\bpermit\b|\bpermit\b.*\bsubmit\b/ },
  { intent: "permit_approve", pattern: /\bapprove\b.*\bpermit\b|\bpermit\b.*\bapprove\b/ },
  { intent: "permit_issue", pattern: /\bissue\b.*\bpermit\b|\bpermit\b.*\bissue\b/ },
  { intent: "permit_reject", pattern: /\breject\b.*\bpermit\b|\bpermit\b.*\breject\b/ },
  { intent: "customer_update_log", pattern: /\b(log|record)\b.*\b(customer|client)\b.*\b(update|call|conversation|message)\b/ },
  { intent: "record_payment", pattern: /\brecord\s+payment\b|\bpay\b/ },
  { intent: "record_deposit", pattern: /\brecord\s+deposit\b|\bdeposit\b/ },
  { intent: "convert_estimate", pattern: /\bconvert\b.*\bestimate\b|\bestimate\b.*\bconvert\b/ },
  { intent: "generate_invoice", pattern: /\bgenerate\b.*\binvoice\b|\bcreate\b.*\binvoice\b/ },
  { intent: "generate_estimate", pattern: /\bgenerate\b.*\bestimate\b|\bcreate\b.*\bestimate\b/ },
  { intent: "show_priorities", pattern: /\bpriorities\b|\btop\s+priorities\b/ },
  { intent: "show_dashboard", pattern: /\bdashboard\b/ },
  { intent: "show_timeline", pattern: /\btimeline\b|\bactivity\b/ },
  { intent: "send", pattern: /\bsend\b/ },
  { intent: "archive", pattern: /\barchive\b/ },
  { intent: "complete", pattern: /\bcomplete\b|\bfinish\b/ },
  { intent: "start", pattern: /\bstart\b|\bbegin\b|\bresume\b/ },
  { intent: "pause", pattern: /\bpause\b|\bhold\b|\bstop\b/ },
  { intent: "assign", pattern: /\bassign\b/ },
  { intent: "update", pattern: /\bupdate\b|\bedit\b/ },
  { intent: "create", pattern: /\bcreate\b|\bnew\b/ },
  { intent: "view", pattern: /\bview\b/ },
  { intent: "open", pattern: /\bopen\b|\bgo\s+to\b|\bshow\b|\bnavigate\b/ },
  { intent: "search", pattern: /\bfind\b|\bsearch\b|\blookup\b/ },
  { intent: "navigation", pattern: /\broute\b|\bpage\b/ },
];

const ENTITY_HINTS: Array<{ entityType: OrionIntentEntityType; terms: string[] }> = [
  { entityType: "customer", terms: ["customer", "client", "cust"] },
  { entityType: "project", terms: ["project", "job", "proj"] },
  { entityType: "estimate", terms: ["estimate", "quote", "est"] },
  { entityType: "invoice", terms: ["invoice", "bill", "inv"] },
  { entityType: "employee", terms: ["employee", "staff", "worker", "emp"] },
  { entityType: "crew", terms: ["crew", "team"] },
  { entityType: "task", terms: ["task", "todo"] },
  { entityType: "inspection", terms: ["inspection", "inspect", "reinspection", "code check"] },
  { entityType: "permit", terms: ["permit", "license", "approval"] },
  { entityType: "communication", terms: ["communication", "customer update", "message", "call note"] },
  { entityType: "document", terms: ["document", "doc", "file"] },
  { entityType: "timeline", terms: ["timeline", "activity", "history"] },
  { entityType: "dashboard", terms: ["dashboard", "home"] },
  { entityType: "settings", terms: ["settings", "preferences", "config"] },
  { entityType: "operations", terms: ["operations", "ops", "dispatch"] },
];

export function normalizeIntentText(input: string) {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

export function normalizeIntentInput(input: string) {
  const collapsed = collapseWhitespace(input);
  if (!collapsed) {
    return "";
  }

  const greetingMatch = collapsed.match(WAKE_WITH_GREETING_PATTERN);
  if (greetingMatch) {
    return collapseWhitespace(collapsed.slice(greetingMatch[0].length));
  }

  const orionOnlyMatch = collapsed.match(WAKE_ORION_ONLY_PATTERN);
  if (!orionOnlyMatch) {
    return collapsed;
  }

  const remainder = collapseWhitespace(collapsed.slice(orionOnlyMatch[0].length));
  if (!remainder) {
    return "";
  }

  if (COMMAND_START_PATTERN.test(remainder)) {
    return remainder;
  }

  return collapsed;
}

export function parseIntent(input: string) {
  const normalized = normalizeIntentText(input);

  for (const entry of INTENT_PATTERNS) {
    if (entry.pattern.test(normalized)) {
      return entry.intent;
    }
  }

  return "search" as OrionIntentKind;
}

export function parseEntityHint(input: string) {
  const normalized = normalizeIntentText(input);

  for (const entry of ENTITY_HINTS) {
    if (entry.terms.some((term) => normalized.includes(term))) {
      return entry.entityType;
    }
  }

  return null;
}
