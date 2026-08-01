import {
  DOCUMENT_ROLE,
  ESTIMATOR_ROLE,
  FINANCIAL_ROLE,
  HR_ROLE,
  PURCHASING_ROLE,
  SAFETY_ROLE,
  SCHEDULER_ROLE,
  SUPERINTENDENT_ROLE,
} from "../roles";
import type { BangoRoleDefinition, BangoRoleId } from "./context-types";

const REGISTRY: Readonly<Record<BangoRoleId, BangoRoleDefinition>> = {
  superintendent: SUPERINTENDENT_ROLE,
  estimator: ESTIMATOR_ROLE,
  scheduler: SCHEDULER_ROLE,
  safety_manager: SAFETY_ROLE,
  financial_advisor: FINANCIAL_ROLE,
  purchasing_assistant: PURCHASING_ROLE,
  hr_assistant: HR_ROLE,
  document_intelligence: DOCUMENT_ROLE,
};

export function getRoleDefinition(roleId: BangoRoleId): BangoRoleDefinition {
  return REGISTRY[roleId];
}

export function getAllRoleDefinitions(): BangoRoleDefinition[] {
  return Object.values(REGISTRY);
}

export function isRoleSupported(roleId: string): roleId is BangoRoleId {
  return roleId in REGISTRY;
}
