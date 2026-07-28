import Image from "next/image";

type EmployeeAvatarProps = {
  fullName: string;
  avatarUrl: string | null;
  size?: "sm" | "md" | "lg" | "xl";
};

export function EmployeeAvatar({ fullName, avatarUrl, size = "md" }: EmployeeAvatarProps) {
  const sizeClass = size === "sm"
    ? "h-9 w-9"
    : size === "lg"
      ? "h-16 w-16"
      : size === "xl"
        ? "h-28 w-28"
        : "h-11 w-11";

  if (avatarUrl) {
    return (
      <span className={`relative inline-flex overflow-hidden rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] ${sizeClass}`}>
        <Image src={avatarUrl} alt={fullName} fill sizes="112px" className="object-cover" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] text-xs font-semibold text-[var(--color-text-secondary)] ${sizeClass}`}
    >
      {initials(fullName)}
    </span>
  );
}

function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}
