import type { Database } from "@/types/database.types";
import { PROJECT_STATUSES } from "@/lib/projects/statuses";

export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

export const PROJECT_TYPE_OPTIONS = [
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "maintenance", label: "Maintenance" },
  { value: "renovation", label: "Renovation" },
  { value: "new_construction", label: "New Construction" },
  { value: "other", label: "Other" },
] as const;

export function normalizeProjectStatus(status: string | null) {
  const normalized = status?.trim().toLowerCase();

  const matchedStatus = PROJECT_STATUSES.find(
    (projectStatus) => projectStatus.value === normalized,
  );

  if (matchedStatus) {
    return {
      key: matchedStatus.value,
      label: matchedStatus.label,
    };
  }

  return {
    key: normalized || "lead",
    label: toTitleCase((normalized || "lead").replace(/_/g, " ")),
  };
}

export function normalizeProjectType(projectType: string | null) {
  const normalized = projectType?.trim().toLowerCase();

  if (normalized === "residential") {
    return { key: "residential", label: "Residential" };
  }

  if (normalized === "commercial") {
    return { key: "commercial", label: "Commercial" };
  }

  if (normalized === "maintenance") {
    return { key: "maintenance", label: "Maintenance" };
  }

  if (normalized === "renovation") {
    return { key: "renovation", label: "Renovation" };
  }

  if (normalized === "new_construction") {
    return { key: "new_construction", label: "New Construction" };
  }

  if (normalized === "other") {
    return { key: "other", label: "Other" };
  }

  return {
    key: normalized || "other",
    label: toTitleCase(normalized || "other"),
  };
}

export function getProjectDisplayName(project: ProjectRow, fallbackLabel = "Unnamed Project") {
  return project.name.trim() || fallbackLabel;
}

export function formatProjectAddress(project: ProjectRow) {
  const addressParts = [
    project.address_line_1?.trim() || "",
    project.address_line_2?.trim() || "",
    [project.city?.trim() || "", project.state?.trim() || "", project.postal_code?.trim() || ""]
      .filter(Boolean)
      .join(" "),
  ].filter(Boolean);

  return addressParts.length > 0 ? addressParts.join("\n") : "";
}

export function formatProjectCurrency(
  value: number | null,
  locale = "en-US",
  missingLabel = "Not provided",
) {
  if (typeof value !== "number") {
    return missingLabel;
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatProjectDate(
  value: string | null,
  locale = "en-US",
  missingLabel = "Not provided",
) {
  if (!value) {
    return missingLabel;
  }

  const normalizedValue = value.includes("T") ? value : `${value}T00:00:00`;
  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return missingLabel;
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatProjectDateLong(
  value: string | null,
  locale = "en-US",
  missingLabel = "Not provided",
) {
  if (!value) {
    return missingLabel;
  }

  const normalizedValue = value.includes("T") ? value : `${value}T00:00:00`;
  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return missingLabel;
  }

  return new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatProjectBadgeValue(value: string | null) {
  if (!value || !value.trim()) {
    return "Not provided";
  }

  return value;
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}