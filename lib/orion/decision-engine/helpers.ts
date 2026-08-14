import type { BusinessSignalCategory } from "./types";

export function stableId(parts: Array<string | number>) {
  return parts.join("::").toLowerCase().replace(/[^a-z0-9:._-]/g, "_");
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function titleCase(value: string) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function sortCategory(a: BusinessSignalCategory, b: BusinessSignalCategory) {
  return a.localeCompare(b);
}
