import {
  Building2,
  CalendarClock,
  Camera,
  ClipboardList,
  FileClock,
  Handshake,
  Info,
  MapPin,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

type ProjectCommandCenterOverviewPlaceholderProps = {
  projectName: string;
  customerName: string;
  statusLabel: string;
  address: string;
  startDate: string;
  targetCompletionDate: string;
  photosCount: number;
  activityCount: number;
};

const WORKSPACE_PANEL = "min-w-0 rounded-[18px] border border-[var(--bos-border-light)] bg-[linear-gradient(180deg,var(--bos-bg-workspace-card),var(--color-neutral-50))] shadow-[var(--bos-shadow-workspace-card)]";
const WORKSPACE_PANEL_HEADER = "border-b border-[var(--bos-border-light)] bg-[linear-gradient(180deg,#f8fbff,#f2f7fd)]";
const WORKSPACE_SECTION_TITLE = "text-section-title font-bold text-[var(--bos-text-strong-on-light)]";

export function ProjectCommandCenterOverviewPlaceholder({
  projectName,
  customerName,
  statusLabel,
  address,
  startDate,
  targetCompletionDate,
  photosCount,
  activityCount,
}: ProjectCommandCenterOverviewPlaceholderProps) {
  return (
    <div className="min-w-0 space-y-5">
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card as="section" variant="elevated" className={WORKSPACE_PANEL}>
          <CardHeader className={WORKSPACE_PANEL_HEADER}>
            <CardTitle className={`flex items-center gap-2 ${WORKSPACE_SECTION_TITLE}`}>
              <Handshake size={16} aria-hidden="true" />
              Subcontractors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-3 rounded-[12px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-dashed border-[var(--bos-border-light-strong)] bg-white text-[var(--bos-text-medium-on-light)]">
                <Building2 size={18} aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--bos-text-strong-on-light)]">Primary Trade Partner</p>
                <p className="text-xs font-semibold text-[var(--bos-text-medium-on-light)]">No subcontractors assigned yet</p>
              </div>
            </div>

            <StructuredPlaceholderRow label="Status" value="Pending assignment" icon={<Info size={14} aria-hidden="true" />} />
            <StructuredPlaceholderRow label="Contract" value="Not issued" icon={<ClipboardList size={14} aria-hidden="true" />} />
            <StructuredPlaceholderRow label="Insurance" value="Awaiting upload" icon={<ShieldCheck size={14} aria-hidden="true" />} />
            <StructuredPlaceholderRow label="Crew" value="Not scheduled" icon={<Users size={14} aria-hidden="true" />} />
            <StructuredPlaceholderRow label="Payment" value="No terms linked" icon={<Wallet size={14} aria-hidden="true" />} />
          </CardContent>
        </Card>

        <Card as="section" variant="elevated" className={WORKSPACE_PANEL}>
          <CardHeader className={WORKSPACE_PANEL_HEADER}>
            <CardTitle className={`flex items-center gap-2 ${WORKSPACE_SECTION_TITLE}`}>
              <Info size={16} aria-hidden="true" />
              Project Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5 text-sm">
            <InfoRow label="Project" value={projectName} emphasis />
            <InfoRow label="Customer" value={customerName} />
            <InfoRow label="Status" value={statusLabel} />
            <InfoRow label="Job Site" value={address} icon={<MapPin size={13} aria-hidden="true" />} />
            <InfoRow label="Start Date" value={startDate} />
            <InfoRow label="Target Completion" value={targetCompletionDate} />
          </CardContent>
        </Card>

        <div className="grid min-w-0 gap-5">
          <Card as="section" variant="elevated" className={WORKSPACE_PANEL}>
            <CardHeader className={WORKSPACE_PANEL_HEADER}>
              <CardTitle className={`flex items-center gap-2 ${WORKSPACE_SECTION_TITLE}`}>
                <Camera size={16} aria-hidden="true" />
                Photos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              <div className="rounded-[12px] border border-dashed border-[var(--bos-border-light-strong)] bg-[var(--color-neutral-50)] p-3.5 text-center">
                <p className="text-sm font-bold text-[var(--bos-text-strong-on-light)]">No project photos uploaded yet</p>
                <p className="mt-1 text-xs font-semibold text-[var(--bos-text-medium-on-light)]">Photos from SiteCam uploads will appear here and sync into the project timeline automatically.</p>
              </div>
              <div className="flex items-center justify-between rounded-[11px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] px-3 py-2.5">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">Live records</p>
                <Badge tone="info" className="font-semibold">{photosCount} uploaded</Badge>
              </div>
            </CardContent>
          </Card>

          <Card as="section" variant="elevated" className={WORKSPACE_PANEL}>
            <CardHeader className={WORKSPACE_PANEL_HEADER}>
              <CardTitle className={`flex items-center gap-2 ${WORKSPACE_SECTION_TITLE}`}>
                <Users size={16} aria-hidden="true" />
                Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              <div className="space-y-2">
                <ActivitySkeletonRow label="Last update" description="Recent project events and decisions will appear here first." />
                <ActivitySkeletonRow label="Field note" description="Superintendent and field logs will populate this stream." />
                <ActivitySkeletonRow label="Workflow event" description="Approvals, status changes, and milestone actions will be tracked." />
              </div>
              <div className="flex items-center justify-between rounded-[11px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] px-3 py-2.5">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">Live activity count</p>
                <Badge tone="neutral" className="font-semibold">{activityCount} records</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card as="section" variant="elevated" className={WORKSPACE_PANEL}>
        <CardHeader className={WORKSPACE_PANEL_HEADER}>
          <CardTitle className={`flex items-center gap-2 ${WORKSPACE_SECTION_TITLE}`}>
            <FileClock size={16} aria-hidden="true" />
            Project Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2.5 p-5 sm:grid-cols-2 lg:grid-cols-5">
          <TimelineStage label="Planning" />
          <TimelineStage label="Permits" />
          <TimelineStage label="Construction" />
          <TimelineStage label="Punch" />
          <TimelineStage label="Closeout" />
        </CardContent>
      </Card>

      <Card as="section" variant="elevated" className={WORKSPACE_PANEL}>
        <CardHeader className={WORKSPACE_PANEL_HEADER}>
          <CardTitle className={`flex items-center gap-2 ${WORKSPACE_SECTION_TITLE}`}>
            <ClipboardList size={16} aria-hidden="true" />
            Workspace Readiness
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <p className="text-sm font-medium leading-7 text-[var(--bos-text-medium-on-light)]">
            This workspace is ready for project operations. Additional modules will appear here automatically as project records and workflows are connected.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StructuredPlaceholderRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-[11px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] px-3 py-2.5">
      <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--bos-border-light-strong)] bg-white text-[var(--bos-text-medium-on-light)]">
          {icon}
        </span>
        {label}
      </span>
      <span className="min-w-0 break-words text-right text-sm font-bold text-[var(--bos-text-strong-on-light)]">{value}</span>
    </div>
  );
}

function InfoRow({
  label,
  value,
  emphasis = false,
  icon,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 border-b border-[var(--bos-border-light)] pb-2.5 last:border-none last:pb-0">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">{label}</p>
      <p className={`max-w-[70%] break-words text-right ${emphasis ? "text-[1.08rem] font-extrabold text-[var(--bos-text-strong-on-light)]" : "font-bold text-[var(--bos-text-strong-on-light)]"}`}>
        {icon ? <span className="mr-1.5 inline-flex align-middle text-[var(--bos-text-medium-on-light)]">{icon}</span> : null}
        {value}
      </p>
    </div>
  );
}

function ActivitySkeletonRow({ label, description }: { label: string; description: string }) {
  return (
    <div className="rounded-[11px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] px-3 py-2.5">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--bos-text-medium-on-light)]">{description}</p>
    </div>
  );
}

function TimelineStage({ label }: { label: string }) {
  return (
    <div className="rounded-[12px] border border-[var(--bos-border-light)] bg-[linear-gradient(180deg,var(--color-neutral-50),#f2f7fe)] p-3.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
      <span className="mx-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--bos-border-light-strong)] bg-white text-[var(--bos-text-medium-on-light)]">
        <CalendarClock size={14} aria-hidden="true" />
      </span>
      <p className="mt-2 text-sm font-bold text-[var(--bos-text-strong-on-light)]">{label}</p>
      <p className="mt-1 text-xs font-semibold text-[var(--bos-text-medium-on-light)]">Upcoming</p>
    </div>
  );
}
