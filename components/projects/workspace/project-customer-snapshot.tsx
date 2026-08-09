import { Mail, MapPin, Phone, UserRound } from "lucide-react";
import { WorkspaceSection } from "@/components/workspace";

type ProjectCustomerSnapshotProps = {
  jobSiteName: string;
  address: string;
  primaryContactName: string;
  primaryContactPhone: string;
  primaryContactEmail: string;
};

export function ProjectCustomerSnapshot({
  jobSiteName,
  address,
  primaryContactName,
  primaryContactPhone,
  primaryContactEmail,
}: ProjectCustomerSnapshotProps) {
  return (
    <WorkspaceSection
      title="Project Details"
      className="rounded-[18px] border border-[var(--bos-border-light)]"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SnapshotItem icon={<MapPin size={15} aria-hidden="true" />} label="Job Site" value={jobSiteName} detail={address} />
        <SnapshotItem icon={<UserRound size={15} aria-hidden="true" />} label="Primary Contact" value={primaryContactName} />
        <SnapshotItem icon={<Phone size={15} aria-hidden="true" />} label="Phone" value={primaryContactPhone} />
        <SnapshotItem icon={<Mail size={15} aria-hidden="true" />} label="Email" value={primaryContactEmail} />
      </div>
    </WorkspaceSection>
  );
}

function SnapshotItem({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <article className="rounded-[12px] border border-[var(--bos-border-light)] bg-white px-3 py-3">
      <div className="flex items-center gap-2 text-[var(--bos-text-medium-on-light)]">
        {icon}
        <p className="text-xs font-bold uppercase tracking-[0.08em]">{label}</p>
      </div>
      <p className="mt-2 text-sm font-bold text-[var(--bos-text-strong-on-light)]">{value}</p>
      {detail ? <p className="mt-1 text-xs text-[var(--bos-text-medium-on-light)]">{detail}</p> : null}
    </article>
  );
}
