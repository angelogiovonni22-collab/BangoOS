import type { ReactNode } from "react";

type QuantumWorkspaceProps = {
  left: ReactNode;
  right: ReactNode;
};

export function QuantumWorkspace({ left, right }: QuantumWorkspaceProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
      <div className="space-y-4">{left}</div>
      <div className="space-y-4">{right}</div>
    </div>
  );
}
