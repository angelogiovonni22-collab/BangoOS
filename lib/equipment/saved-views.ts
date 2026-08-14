export const EQUIPMENT_SAVED_VIEWS_STORAGE_KEY = "bangoos.equipment.savedViews.v1";

export type EquipmentSavedView = {
  id: string;
  name: string;
  query: string;
  status: string;
  equipmentType: string;
  category: string;
  ownershipType: string;
  vendorId: string;
  maintenanceStatus: string;
  locationType: string;
  defaultCostCodeId: string;
  criticalityLevel: string;
  replacementPriority: string;
  assignedJobId: string;
  assignedEmployeeId: string;
  sortBy: string;
};

export type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export function readSavedEquipmentViews(storage: StorageLike | null | undefined, key: string = EQUIPMENT_SAVED_VIEWS_STORAGE_KEY): EquipmentSavedView[] {
  if (!storage) {
    return [];
  }

  const raw = storage.getItem(key);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as EquipmentSavedView[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeSavedEquipmentViews(storage: StorageLike | null | undefined, views: EquipmentSavedView[], key: string = EQUIPMENT_SAVED_VIEWS_STORAGE_KEY) {
  if (!storage) {
    return;
  }

  storage.setItem(key, JSON.stringify(views));
}
