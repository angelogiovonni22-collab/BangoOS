type ProjectAvatarProps = {
  name: string;
  className?: string;
};

export function ProjectAvatar({ name, className }: ProjectAvatarProps) {
  const initials = getInitials(name);

  return (
    <span
      className={[
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] text-xs font-semibold text-[var(--color-text-secondary)]",
        className || "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

function getInitials(value: string) {
  const words = value
    .split(" ")
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (words.length === 0) {
    return "--";
  }

  return words.map((word) => word.charAt(0).toUpperCase()).join("");
}
