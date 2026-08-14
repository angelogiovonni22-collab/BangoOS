const ENTRANCE_ONCE_KEYS = new Set<string>();

export function collectNewEntityIds(previousIds: Set<string>, nextIds: string[]): Record<string, true> {
  const result: Record<string, true> = {};

  for (const id of nextIds) {
    if (!previousIds.has(id)) {
      result[id] = true;
    }
  }

  return result;
}

export function hasAnimatedEntries(entries: Record<string, true>): boolean {
  return Object.keys(entries).length > 0;
}

export function shouldAnimateEntranceOnce(key: string): boolean {
  return !ENTRANCE_ONCE_KEYS.has(key);
}

export function markEntranceAnimated(key: string): void {
  ENTRANCE_ONCE_KEYS.add(key);
}
