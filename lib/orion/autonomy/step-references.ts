export type OrionStepReferenceOutput = {
  index: number;
  commandId: string;
  entityId: string | null;
  href: string | null;
  createdEntityIds: string[];
  updatedEntityIds: string[];
  details: Record<string, unknown>;
};

export type OrionStepReferenceResolution =
  | { ok: true; value: unknown; referencesResolved: number }
  | { ok: false; error: string; referencesResolved: number };

const REFERENCE_PREFIX = "$step.";
const REFERENCE_PATTERN = /^\$step\.(\d+)\.(entityId|href|createdEntityIds|updatedEntityIds|details)(?:\.([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*))?$/;
const BLOCKED_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);
const MAX_REFERENCE_DEPTH = 10;
const MAX_VALUE_DEPTH = 20;

function readPath(value: unknown, path: string[]): { ok: true; value: unknown } | { ok: false } {
  let current = value;
  for (const segment of path) {
    if (BLOCKED_PATH_SEGMENTS.has(segment)) return { ok: false };
    if (Array.isArray(current)) {
      if (!/^\d+$/.test(segment)) return { ok: false };
      const index = Number(segment);
      if (!Number.isSafeInteger(index) || index < 0 || index >= current.length) return { ok: false };
      current = current[index];
      continue;
    }
    if (!current || typeof current !== "object") return { ok: false };
    if (!Object.prototype.hasOwnProperty.call(current, segment)) return { ok: false };
    current = (current as Record<string, unknown>)[segment];
  }
  return { ok: true, value: current };
}

function resolveReference(input: string, outputs: OrionStepReferenceOutput[], currentStepIndex: number): OrionStepReferenceResolution {
  if (!input.startsWith(REFERENCE_PREFIX)) return { ok: true, value: input, referencesResolved: 0 };

  const match = REFERENCE_PATTERN.exec(input);
  if (!match) {
    return { ok: false, error: `Invalid Orion step reference: ${input}.`, referencesResolved: 0 };
  }

  const sourceIndex = Number(match[1]);
  if (!Number.isSafeInteger(sourceIndex) || sourceIndex < 1 || sourceIndex >= currentStepIndex) {
    return { ok: false, error: `Step ${currentStepIndex} may reference only an earlier completed step.`, referencesResolved: 0 };
  }

  const output = outputs.find((item) => item.index === sourceIndex);
  if (!output) {
    return { ok: false, error: `Step ${sourceIndex} has no verified output available for chaining.`, referencesResolved: 0 };
  }

  const root = match[2] as "entityId" | "href" | "createdEntityIds" | "updatedEntityIds" | "details";
  const extraPath = match[3] ? match[3].split(".") : [];
  if (extraPath.length > MAX_REFERENCE_DEPTH) {
    return { ok: false, error: `Step reference ${input} is too deeply nested.`, referencesResolved: 0 };
  }

  const resolved = readPath(output[root], extraPath);
  if (!resolved.ok || resolved.value === undefined) {
    return { ok: false, error: `Step reference ${input} does not resolve to an available value.`, referencesResolved: 0 };
  }

  return { ok: true, value: resolved.value, referencesResolved: 1 };
}

function resolveValue(
  value: unknown,
  outputs: OrionStepReferenceOutput[],
  currentStepIndex: number,
  depth: number,
): OrionStepReferenceResolution {
  if (depth > MAX_VALUE_DEPTH) {
    return { ok: false, error: "Orion chained step parameters are too deeply nested.", referencesResolved: 0 };
  }

  if (typeof value === "string") return resolveReference(value, outputs, currentStepIndex);
  if (value === null || typeof value === "number" || typeof value === "boolean" || value === undefined) {
    return { ok: true, value, referencesResolved: 0 };
  }

  if (Array.isArray(value)) {
    const next: unknown[] = [];
    let referencesResolved = 0;
    for (const item of value) {
      const resolved = resolveValue(item, outputs, currentStepIndex, depth + 1);
      referencesResolved += resolved.referencesResolved;
      if (!resolved.ok) return { ok: false, error: resolved.error, referencesResolved };
      next.push(resolved.value);
    }
    return { ok: true, value: next, referencesResolved };
  }

  if (typeof value === "object") {
    const next: Record<string, unknown> = {};
    let referencesResolved = 0;
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (BLOCKED_PATH_SEGMENTS.has(key)) {
        return { ok: false, error: `Unsafe chained parameter key: ${key}.`, referencesResolved };
      }
      const resolved = resolveValue(item, outputs, currentStepIndex, depth + 1);
      referencesResolved += resolved.referencesResolved;
      if (!resolved.ok) return { ok: false, error: resolved.error, referencesResolved };
      next[key] = resolved.value;
    }
    return { ok: true, value: next, referencesResolved };
  }

  return { ok: false, error: "Unsupported value in Orion chained step parameters.", referencesResolved: 0 };
}

export function resolveOrionStepReferences(args: {
  params: Record<string, unknown>;
  outputs: OrionStepReferenceOutput[];
  currentStepIndex: number;
}): OrionStepReferenceResolution {
  return resolveValue(args.params, args.outputs, args.currentStepIndex, 0);
}
