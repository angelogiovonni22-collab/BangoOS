export type FieldProductionInput = {
  activity: string;
  quantity: string;
  unit: string;
  percentComplete: string;
};

export type FieldProductionEntry = {
  activity: string;
  quantity: number;
  unit: string;
  percentComplete: number;
};

export function normalizeFieldProduction(input: FieldProductionInput): FieldProductionEntry | null {
  const activity = input.activity.trim();
  const unit = input.unit.trim();
  const quantity = Number(input.quantity);
  const percentComplete = Number(input.percentComplete);

  if (!activity || !unit || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(percentComplete) || percentComplete < 0 || percentComplete > 100) {
    return null;
  }

  return { activity, quantity, unit, percentComplete };
}

export function isFieldProductionValid(input: FieldProductionInput): boolean {
  return normalizeFieldProduction(input) !== null;
}
