"use client";

import Link from "next/link";
import { useAdaptiveBos } from "@/lib/adaptive-bos/provider";

export function AdaptiveVendorActions({ canManageTradePartners }: { canManageTradePartners: boolean }) {
  const { industryKey } = useAdaptiveBos();

  if (!canManageTradePartners || industryKey !== "construction") return null;

  return (
    <div className="container-content flex flex-wrap justify-end gap-2">
      <Link href="/trade-partners/invite" className="inline-flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-[var(--shadow-small)] transition hover:bg-blue-500">
        Invite Trade Partner
      </Link>
      <Link href="/trade-partners" className="inline-flex h-10 items-center rounded-lg border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] px-4 text-sm font-semibold shadow-[var(--shadow-small)] transition hover:bg-[var(--bos-bg-hover)]">
        Trade Partners Control Center
      </Link>
    </div>
  );
}
