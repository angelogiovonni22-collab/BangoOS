"use client";

type OrionHandsFreeToggleProps = {
  enabled: boolean;
  unsupported?: boolean;
  onChange: (enabled: boolean) => void;
};

export function OrionHandsFreeToggle({ enabled, unsupported = false, onChange }: OrionHandsFreeToggleProps) {
  return (
    <label className="inline-flex items-center gap-2 rounded border border-white/20 bg-white/5 px-2 py-1 text-xs text-slate-100">
      <input
        type="checkbox"
        checked={enabled}
        disabled={unsupported}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      Hands-Free Orion
    </label>
  );
}
