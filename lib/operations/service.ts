import {
  getOperationsPayload,
} from "./mock-data";
import type {
  OperationsFilters,
  OperationsPayload,
} from "./types";

export type OperationsService = {
  getOperations: (filters: OperationsFilters) => Promise<OperationsPayload>;
};

export function createOperationsService(): OperationsService {
  return {
    async getOperations(filters) {
      return getOperationsPayload(filters);
    },
  };
}
