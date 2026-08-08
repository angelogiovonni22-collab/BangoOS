import Link from "next/link";
import { Building2, Image as ImageIcon, MapPin, UserRound } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { WorkspaceHero } from "@/components/workspace";

type ProjectWorkspaceHeroProps = {
  projectName: string;
  customerName: string;
  statusLabel: string;
  statusKey: string;
  customerHref: string | null;
  address: string;
  imageUrl: string | null;
  photoCount: number;
};

export function ProjectWorkspaceHero({
  projectName,
  customerName,
  statusLabel,
  statusKey,
  customerHref,
  address,
  imageUrl,
  photoCount,
}: ProjectWorkspaceHeroProps) {
  const statusBadge = heroStatusBadge(statusKey);

  return (
    <WorkspaceHero
      title={projectName}
      subtitle="Operational Snapshot"
      badgeLabel={statusLabel}
      badgeTone={statusBadge.tone}
      media={
        <div className="relative overflow-hidden rounded-[18px] border border-[#3a5d90] bg-[#0a1326] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`${projectName} hero`}
              className="h-[300px] w-full object-cover transition duration-500 group-hover:scale-[1.015] md:h-[360px]"
            />
          ) : (
            <div className="flex h-[300px] w-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_20%_20%,#1d3766_0%,#0f1e3e_45%,#0a1428_100%)] text-[#b7cae8] md:h-[360px]">
              <ImageIcon size={34} aria-hidden="true" />
              <p className="text-sm font-semibold">No project photo yet</p>
              <p className="text-xs font-medium text-[#a3bae0]">Photos will appear here once field uploads begin.</p>
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-[linear-gradient(180deg,rgba(7,13,26,0)_0%,rgba(7,13,26,0.86)_65%,rgba(7,13,26,0.94)_100%)]" />

          <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
            <div className="space-y-2">
              <Badge tone={statusBadge.tone} className={`border px-3 py-1 text-xs font-bold tracking-[0.05em] ${statusBadge.className}`}>
                {statusLabel}
              </Badge>
              <h2 className="max-w-[90%] break-words text-[1.68rem] font-extrabold leading-[1.08] tracking-[-0.02em] text-[#f6faff] md:text-[2.06rem]">
                {projectName}
              </h2>
            </div>
          </div>

          <div className="absolute left-3 top-3">
            <Badge tone="neutral" className="border border-[#567cad] bg-[#123055]/95 px-2.5 py-1 text-xs font-semibold tracking-[0.02em] text-[#e6f1ff]">
              {photoCount} photo{photoCount === 1 ? "" : "s"}
            </Badge>
          </div>
        </div>
      }
      details={
        <>
          <div className="rounded-[12px] border border-[#456a9d] bg-[#112441]/74 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#c5d7ef]">Customer</p>
            <p className="mt-1 break-words text-[1.36rem] font-extrabold leading-tight text-[#f5f9ff]">{customerName}</p>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#c5d7ef]">Job-site address</p>
            <div className="mt-2 flex items-start gap-2.5 rounded-[12px] border border-[#416493] bg-[#112441]/74 p-3">
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#285081] text-[#e0eeff]">
                <Building2 size={14} aria-hidden="true" />
              </span>
              <p className="text-sm font-semibold leading-6 text-[#eef5ff]">{address}</p>
            </div>
          </div>
        </>
      }
      actions={
        <>
          {customerHref ? (
            <Link href={customerHref}>
              <Button
                size="sm"
                variant="primary"
                className="rounded-[11px] border border-[#89b4e5] bg-[linear-gradient(180deg,#3a74b8,#2a598f)] px-4 py-2.5 text-[0.82rem] font-semibold tracking-[0.01em] text-white shadow-[0_10px_18px_-12px_rgba(22,82,168,0.7)]"
              >
                <UserRound size={15} aria-hidden="true" />
                View Customer
              </Button>
            </Link>
          ) : (
            <Button type="button" size="sm" variant="outline" className="border-[#5579a8] text-[#c8dcf5] disabled:border-[#3f5b80] disabled:text-[#8ea7ca]" disabled>
              <UserRound size={15} aria-hidden="true" />
              Customer unavailable
            </Button>
          )}

          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#5b81b2] bg-[#122744]/85 px-2.5 py-1 text-xs font-semibold text-[#d3e4f9]">
            <MapPin size={13} aria-hidden="true" />
            Live project location
          </span>
        </>
      }
      footer={
        <div className="mt-5 border-t border-[#3b608f] pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#c5d7ef]">Operational Snapshot</p>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            <FutureMetricChip label="Today's Crew" />
            <FutureMetricChip label="Project Health" />
            <FutureMetricChip label="Budget Used" />
            <FutureMetricChip label="Days Remaining" />
            <FutureMetricChip label="Latest Activity" className="sm:col-span-2" />
          </div>
        </div>
      }
    />
  );
}

function FutureMetricChip({ label, className }: { label: string; className?: string }) {
  return (
    <div className={["rounded-[10px] border border-[#4b6f9f] bg-[#132a49]/78 px-3 py-2", className || ""].filter(Boolean).join(" ")}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#bed2ec]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#edf5ff]">Pending data</p>
    </div>
  );
}

function heroStatusBadge(statusKey: string): { tone: "brand" | "success" | "warning" | "danger" | "neutral" | "info"; className: string } {
  const normalized = statusKey.trim().toLowerCase();

  if (normalized === "completed") {
    return { tone: "success", className: "border-[#4f987f] bg-[#15392f] text-[#d8f6e7]" };
  }

  if (normalized === "cancelled" || normalized === "error" || normalized === "blocked") {
    return { tone: "danger", className: "border-[#ba6871] bg-[#4a1f2a] text-[#ffd9df]" };
  }

  if (normalized === "on_hold" || normalized === "pending" || normalized === "at_risk") {
    return { tone: "warning", className: "border-[#c99148] bg-[#4a3115] text-[#ffe8c8]" };
  }

  if (normalized === "scheduled" || normalized === "upcoming") {
    return { tone: "info", className: "border-[#6e8fd0] bg-[#1b3761] text-[#deebff]" };
  }

  if (normalized === "in_progress" || normalized === "active") {
    return { tone: "success", className: "border-[#5a9cc6] bg-[#1a3f5f] text-[#def1ff]" };
  }

  if (normalized === "lead" || normalized === "estimating") {
    return { tone: "neutral", className: "border-[#6f85a5] bg-[#273c5a] text-[#e5edfb]" };
  }

  return { tone: "brand", className: "border-[#5f85bc] bg-[#193960] text-[#e1efff]" };
}
