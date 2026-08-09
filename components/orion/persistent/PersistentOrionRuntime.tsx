"use client";

import { PersistentOrion as PersistentOrionSurface } from "./PersistentOrion";
import { OrionRealtimeRuntimeProvider } from "./OrionRealtimeRuntime";

export function PersistentOrionRuntime() {
  return (
    <OrionRealtimeRuntimeProvider>
      <PersistentOrionSurface />
    </OrionRealtimeRuntimeProvider>
  );
}
