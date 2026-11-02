import type { UpsertEmployeeInput } from "./types";
import type { WorkforceCreateEmployeeInput, WorkforceUpdateEmployeeInput } from "@/lib/workforce/workforce-types";

function employmentStatus(value: string) {
  const status = value === "on_leave" ? "leave" : value;
  if (status === "active" || status === "inactive" || status === "leave" || status === "terminated") return status;
  throw new Error("Unsupported employment status.");
}

function availabilityStatus(value: string) {
  const status = value === "off_shift" ? "unavailable" : value;
  if (status === "available" || status === "assigned" || status === "unavailable" || status === "restricted" || status === "unknown") return status;
  throw new Error("Unsupported availability status.");
}

export function employeeRecordInput(input: UpsertEmployeeInput, mode: "create"): WorkforceCreateEmployeeInput;
export function employeeRecordInput(input: UpsertEmployeeInput, mode: "edit"): WorkforceUpdateEmployeeInput;
export function employeeRecordInput(input: UpsertEmployeeInput, mode: "create" | "edit"): WorkforceUpdateEmployeeInput {
  const name = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  const status = employmentStatus(input.employmentStatus);
  const number = input.employeeNumber?.trim();
  if (input.birthDate || input.address || input.avatarUrl || input.skills?.length || input.certifications?.length
    || input.emergencyContact?.name || input.emergencyContact?.phone || input.emergencyContact?.relationship
    || input.currentAssignment || input.activeToday) {
    throw new Error("Use the dedicated workforce workflows for unsupported employee fields.");
  }
  if (!name || name.length > 200 || !input.position.trim() || !input.hiredOn) throw new Error("Employee name, position and hire date are required.");
  if (email && (!email.includes("@") || email.length > 320)) throw new Error("Employee email is invalid.");
  if (phone.length > 64) throw new Error("Employee phone is too long.");
  if (mode === "create" && !number) throw new Error("Employee number is required.");
  if (status === "terminated" && !input.terminationDate) throw new Error("Termination date is required.");
  return {
    employee_number: number || undefined,
    full_name: name,
    contact_email: email || null,
    contact_phone: phone || null,
    profile_id: mode === "create" ? input.profileId ?? null : input.profileId,
    supervisor_profile_id: mode === "create" ? input.supervisorProfileId ?? null : input.supervisorProfileId,
    primary_crew_id: mode === "create" ? input.primaryCrewId ?? null : input.primaryCrewId,
    trade: input.trade === undefined ? (mode === "create" ? null : undefined) : input.trade.trim() || null,
    position_title: input.position.trim(),
    employment_status: status,
    termination_date: status === "terminated" ? input.terminationDate : null,
    hire_date: input.hiredOn,
    availability_status: availabilityStatus(input.availabilityStatus),
    notes: input.notes?.trim() || null,
  };
}
