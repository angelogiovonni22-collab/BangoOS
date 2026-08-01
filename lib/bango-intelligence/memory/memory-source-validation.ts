import type { MemorySourceReference } from "./memory-types";

const MAX_SOURCE_REFERENCE_COUNT = 20;
const MAX_REF_FIELD_LENGTH = 200;

export function validateSourceReferences(references: MemorySourceReference[]): { ok: true } | { ok: false; error: string } {
  if (references.length > MAX_SOURCE_REFERENCE_COUNT) {
    return { ok: false, error: `A maximum of ${MAX_SOURCE_REFERENCE_COUNT} source references is allowed.` };
  }

  for (const reference of references) {
    if (!reference.id || reference.id.length > MAX_REF_FIELD_LENGTH) {
      return { ok: false, error: "Invalid source reference id." };
    }
    if (!reference.label || reference.label.length > MAX_REF_FIELD_LENGTH) {
      return { ok: false, error: "Invalid source reference label." };
    }
    if (!reference.type || reference.type.length > MAX_REF_FIELD_LENGTH) {
      return { ok: false, error: "Invalid source reference type." };
    }
    if (reference.href && reference.href.length > 500) {
      return { ok: false, error: "Source reference href is too long." };
    }
  }

  return { ok: true };
}
