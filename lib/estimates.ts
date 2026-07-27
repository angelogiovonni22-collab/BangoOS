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

export function formatEstimateCurrency(
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
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatEstimateDate(
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
