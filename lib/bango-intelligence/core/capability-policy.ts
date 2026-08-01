import {
  EXECUTION_CAPABILITIES,
  type BangoCapabilityId,
  type BangoRoleDefinition,
  type BangoBusinessContext,
} from "./context-types";
import { getApprovalLevelForCapability } from "./approval-policy";

export function buildCapabilityPolicyForRole(
  role: BangoRoleDefinition,
): {
  allowedCapabilities: BangoCapabilityId[];
  deniedCapabilities: BangoCapabilityId[];
  approvalRequirements: Partial<Record<BangoCapabilityId, ReturnType<typeof getApprovalLevelForCapability>>>;
} {
  const allowed = Array.from(new Set(role.allowedCapabilities));
  const denied = Array.from(new Set(role.deniedCapabilities));

  for (const capability of EXECUTION_CAPABILITIES) {
    if (!denied.includes(capability)) {
      denied.push(capability);
    }
  }

  const approvalRequirements: Partial<Record<BangoCapabilityId, ReturnType<typeof getApprovalLevelForCapability>>> = {};
  for (const capability of allowed) {
    approvalRequirements[capability] = getApprovalLevelForCapability(role, capability);
  }
  for (const capability of denied) {
    approvalRequirements[capability] = "prohibited";
  }

  return {
    allowedCapabilities: allowed,
    deniedCapabilities: denied,
    approvalRequirements,
  };
}

export function applyCapabilityPolicyToContext(
  context: BangoBusinessContext,
  role: BangoRoleDefinition,
): BangoBusinessContext {
  const policy = buildCapabilityPolicyForRole(role);

  return {
    ...context,
    permissions: {
      allowedCapabilities: policy.allowedCapabilities,
      deniedCapabilities: policy.deniedCapabilities,
      approvalRequirements: policy.approvalRequirements,
    },
  };
}

export function canRoleUseCapability(
  role: BangoRoleDefinition,
  capability: BangoCapabilityId,
): boolean {
  if (role.deniedCapabilities.includes(capability)) {
    return false;
  }

  return role.allowedCapabilities.includes(capability);
}
