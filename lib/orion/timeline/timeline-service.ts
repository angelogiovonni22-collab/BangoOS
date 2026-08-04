import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { queryOrionTimeline } from "./timeline-query";
import type { OrionTimelineQueryFilters, OrionTimelineQueryResult } from "./timeline-types";

export type OrionTimelineService = {
  listCompanyTimeline: (companyId: string, filters?: OrionTimelineQueryFilters) => Promise<OrionTimelineQueryResult>;
  listProjectTimeline: (companyId: string, projectId: string, filters?: OrionTimelineQueryFilters) => Promise<OrionTimelineQueryResult>;
  listCustomerTimeline: (companyId: string, customerId: string, filters?: OrionTimelineQueryFilters) => Promise<OrionTimelineQueryResult>;
  listEntityTimeline: (companyId: string, entityType: string, entityId: string, filters?: OrionTimelineQueryFilters) => Promise<OrionTimelineQueryResult>;
};

export function createOrionTimelineService(supabase: SupabaseClient<Database>): OrionTimelineService {
  return {
    listCompanyTimeline(companyId, filters = {}) {
      return queryOrionTimeline(supabase, companyId, filters);
    },

    listProjectTimeline(companyId, projectId, filters = {}) {
      return queryOrionTimeline(supabase, companyId, {
        ...filters,
        projectId,
      });
    },

    listCustomerTimeline(companyId, customerId, filters = {}) {
      return queryOrionTimeline(supabase, companyId, {
        ...filters,
        customerId,
      });
    },

    listEntityTimeline(companyId, entityType, entityId, filters = {}) {
      return queryOrionTimeline(supabase, companyId, {
        ...filters,
        entityType,
        entityId,
      });
    },
  };
}
