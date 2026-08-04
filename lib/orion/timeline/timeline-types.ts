export type OrionTimelineCategory =
  | "customers"
  | "sales"
  | "projects"
  | "finance"
  | "workforce"
  | "scheduling"
  | "field"
  | "safety"
  | "system";

export type OrionTimelineSeverity =
  | "info"
  | "success"
  | "attention"
  | "warning"
  | "critical";

export type OrionTimelineCursor = {
  occurredAt: string;
  id: string;
};

export type OrionTimelineQueryFilters = {
  from?: string;
  to?: string;
  categories?: OrionTimelineCategory[];
  severities?: OrionTimelineSeverity[];
  eventTypes?: string[];
  sourceModules?: string[];
  actorProfileId?: string;
  projectId?: string;
  customerId?: string;
  entityType?: string;
  entityId?: string;
  searchText?: string;
  cursor?: OrionTimelineCursor;
  pageSize?: number;
  includeLegacyAdapters?: boolean;
};

export type OrionTimelineItem = {
  id: string;
  sourceEventId: string;
  companyId: string;
  eventType: string;
  sourceModule: string;
  entityType: string;
  entityId: string;
  projectId: string | null;
  customerId: string | null;
  actorProfileId: string | null;
  category: OrionTimelineCategory;
  severity: OrionTimelineSeverity;
  title: string;
  summary: string;
  href: string | null;
  occurredAt: string;
  correlationId: string | null;
  causationId: string | null;
  displayData: Record<string, unknown>;
  titleKey: string;
  summaryKey: string;
  actorName: string | null;
  projectName: string | null;
  customerName: string | null;
};

export type OrionTimelineQueryResult = {
  items: OrionTimelineItem[];
  nextCursor: OrionTimelineCursor | null;
  hasMore: boolean;
};

export type OrionTimelineContextMaps = {
  estimateById: Map<string, { id: string; estimateNumber: string | null; projectId: string | null; customerId: string | null; title: string | null }>;
  invoiceById: Map<string, { id: string; invoiceNumber: string | null; projectId: string | null; customerId: string | null; title: string | null }>;
  changeOrderById: Map<string, { id: string; changeOrderNumber: string | null; projectId: string | null; customerId: string | null; title: string | null }>;
  profileById: Map<string, { id: string; firstName: string | null; lastName: string | null }>;
  projectById: Map<string, { id: string; name: string }>;
  customerById: Map<string, { id: string; firstName: string | null; lastName: string | null; companyName: string | null; customerType: string | null }>;
};
