import type { OrionTimelineItem } from "./timeline-types";

export function formatTimelineText(item: OrionTimelineItem, t: (key: string, params?: Record<string, string | number>) => string) {
  const title = t(item.titleKey);
  const summary = t(item.summaryKey, {
    customerName: item.customerName || "Customer",
    estimateNumber: readDisplayString(item.displayData, "estimate_number") || "record",
    invoiceNumber: readDisplayString(item.displayData, "invoice_number") || "record",
    projectNumberOrName: readDisplayString(item.displayData, "project_number") || item.projectName || "record",
  });

  return {
    title: title === item.titleKey ? item.title : title,
    summary: summary === item.summaryKey ? item.summary : summary,
  };
}

export function formatTimelineOccurredAt(occurredAt: string, localeTag: string) {
  return new Intl.DateTimeFormat(localeTag, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(occurredAt));
}

function readDisplayString(displayData: Record<string, unknown>, key: string) {
  const value = displayData[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
