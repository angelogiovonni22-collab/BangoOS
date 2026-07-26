import { ESTIMATE_STATUSES } from "@/lib/estimates/statuses";

export function normalizeEstimateStatus(status: string | null) {
  const normalized = status?.trim().toLowerCase();

  const matchedStatus = ESTIMATE_STATUSES.find(
    (estimateStatus) => estimateStatus.value === normalized,
  );

  if (matchedStatus) {
    return {
      key: matchedStatus.value,
      label: matchedStatus.label,
    };
  }

  return {
    key: normalized || "draft",
    label: toTitleCase((normalized || "draft").replace(/_/g, " ")),
  };
}

export function formatEstimateCurrency(value: number | null) {
  if (typeof value !== "number") {
    return "Not provided";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatEstimateDate(value: string | null) {
  if (!value) {
    return "Not provided";
  }

  const normalizedValue = value.includes("T") ? value : `${value}T00:00:00`;
  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return "Not provided";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function getEstimateNumber(estimateNumber: string | null) {
  const normalized = estimateNumber?.trim() || "";

  return normalized || "Not assigned";
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
