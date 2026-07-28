import type { ReactNode } from "react";

type IconProps = {
  className?: string;
};

function IconBase({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className || "h-5 w-5"}
    >
      {children}
    </svg>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M16 19c0-2.2-1.8-4-4-4s-4 1.8-4 4" />
      <circle cx="12" cy="9" r="3" />
      <path d="M20 19c0-1.4-.8-2.7-2-3.4" />
      <path d="M4 19c0-1.4.8-2.7 2-3.4" />
    </IconBase>
  );
}

export function UserCheckIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.8 18a5.2 5.2 0 0 1 10.4 0" />
      <path d="m15.5 11.5 2 2 3.2-3.2" />
    </IconBase>
  );
}

export function CircleCheckIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="8" />
      <path d="m8.8 12.1 2.1 2.1 4.3-4.3" />
    </IconBase>
  );
}

export function BriefcaseIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M3 12h18" />
    </IconBase>
  );
}

export function BedDoubleIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
      <path d="M3 14h18" />
      <path d="M7 10V8a2 2 0 0 1 4 0v2" />
      <path d="M13 10V8a2 2 0 0 1 4 0v2" />
    </IconBase>
  );
}

export function CameraIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <circle cx="12" cy="13" r="3" />
      <path d="M8 7 9.5 5h5L16 7" />
    </IconBase>
  );
}

export function UploadIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M12 16V7" />
      <path d="m8.5 10.5 3.5-3.5 3.5 3.5" />
      <path d="M5 19h14" />
    </IconBase>
  );
}

export function PhoneIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M6 4h3l1 4-2 1.4a15 15 0 0 0 6.6 6.6L16 14l4 1v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4 6.2 2 2 0 0 1 6 4Z" />
    </IconBase>
  );
}

export function MailIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </IconBase>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect x="4" y="6" width="16" height="14" rx="2" />
      <path d="M8 4v4" />
      <path d="M16 4v4" />
      <path d="M4 10h16" />
    </IconBase>
  );
}
