export class EquipmentDispatchUnavailableError extends Error {
  constructor() {
    super("Equipment was not assigned. Crew dispatch is unavailable; use the equipment profile to manage its assignment.");
    this.name = "EquipmentDispatchUnavailableError";
  }
}

export async function requireEquipmentDispatchSuccess(
  dispatch: () => Promise<{ success: boolean }>,
): Promise<void> {
  const result = await dispatch();
  if (!result.success) {
    throw new EquipmentDispatchUnavailableError();
  }
}
