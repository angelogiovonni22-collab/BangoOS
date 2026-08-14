import type { ConversionPreviewResult, ConvertibleUnit } from "./types";

function toFiniteNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundToPrecision(value: number, decimalPrecision: number) {
  const safePrecision = Math.max(0, Math.min(8, Math.trunc(decimalPrecision)));
  const factor = 10 ** safePrecision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatByPrecision(value: number, decimalPrecision: number) {
  const safePrecision = Math.max(0, Math.min(8, Math.trunc(decimalPrecision)));
  return roundToPrecision(value, safePrecision).toFixed(safePrecision);
}

export function convertToBaseUnit(quantity: number, conversionFactor: number) {
  const parsedQuantity = toFiniteNumber(quantity);
  const parsedFactor = toFiniteNumber(conversionFactor);

  if (parsedQuantity === null || parsedFactor === null || parsedFactor <= 0) {
    return null;
  }

  return parsedQuantity * parsedFactor;
}

export function convertFromBaseUnit(baseQuantity: number, conversionFactor: number) {
  const parsedBaseQuantity = toFiniteNumber(baseQuantity);
  const parsedFactor = toFiniteNumber(conversionFactor);

  if (parsedBaseQuantity === null || parsedFactor === null || parsedFactor <= 0) {
    return null;
  }

  return parsedBaseQuantity / parsedFactor;
}

function resolveRootBaseId(unit: Pick<ConvertibleUnit, "id" | "base_unit_id">) {
  return unit.base_unit_id || unit.id;
}

export function convertBetweenCompatibleUnits(
  quantity: number,
  fromUnit: ConvertibleUnit,
  toUnit: ConvertibleUnit,
) {
  const parsedQuantity = toFiniteNumber(quantity);

  if (parsedQuantity === null) {
    return null;
  }

  if (fromUnit.id === toUnit.id) {
    return roundToPrecision(parsedQuantity, toUnit.decimal_precision);
  }

  const fromRoot = resolveRootBaseId(fromUnit);
  const toRoot = resolveRootBaseId(toUnit);

  if (fromRoot !== toRoot) {
    return null;
  }

  const quantityInBase = fromUnit.base_unit_id
    ? convertToBaseUnit(parsedQuantity, fromUnit.conversion_factor ?? NaN)
    : parsedQuantity;

  if (quantityInBase === null) {
    return null;
  }

  const quantityInTarget = toUnit.base_unit_id
    ? convertFromBaseUnit(quantityInBase, toUnit.conversion_factor ?? NaN)
    : quantityInBase;

  if (quantityInTarget === null) {
    return null;
  }

  return roundToPrecision(quantityInTarget, toUnit.decimal_precision);
}

export function formatUnitQuantity(quantity: number, unit: Pick<ConvertibleUnit, "code" | "symbol" | "decimal_precision">) {
  const parsedQuantity = toFiniteNumber(quantity);

  if (parsedQuantity === null) {
    return "-";
  }

  const numberText = formatByPrecision(parsedQuantity, unit.decimal_precision);
  const unitText = unit.symbol?.trim() || unit.code;
  return `${numberText} ${unitText}`;
}

export function buildConversionPreview(
  currentValues: {
    code: string;
    decimalPrecision: number;
    baseUnitId: string;
    conversionFactor: string;
  },
  baseUnit: ConvertibleUnit | null,
  exampleQuantity = 5,
): ConversionPreviewResult {
  const code = currentValues.code.trim().toUpperCase();

  if (!currentValues.baseUnitId) {
    return {
      isValid: false,
      message: "Select a base unit to preview conversion.",
      oneUnitText: null,
      sampleText: null,
    };
  }

  if (!baseUnit) {
    return {
      isValid: false,
      message: "Base unit is unavailable.",
      oneUnitText: null,
      sampleText: null,
    };
  }

  const factor = toFiniteNumber(currentValues.conversionFactor);

  if (factor === null || factor <= 0) {
    return {
      isValid: false,
      message: "Enter a valid conversion factor greater than 0.",
      oneUnitText: null,
      sampleText: null,
    };
  }

  const oneConverted = convertToBaseUnit(1, factor);
  const sampleConverted = convertToBaseUnit(exampleQuantity, factor);

  if (oneConverted === null || sampleConverted === null) {
    return {
      isValid: false,
      message: "Unable to calculate conversion preview.",
      oneUnitText: null,
      sampleText: null,
    };
  }

  const safePrecision = Math.max(0, Math.min(8, Math.trunc(currentValues.decimalPrecision)));
  const unitLabel = code || "UNIT";
  const baseLabel = baseUnit.symbol?.trim() || baseUnit.code;

  return {
    isValid: true,
    message: "Conversion preview",
    oneUnitText: `1 ${unitLabel} = ${formatByPrecision(oneConverted, baseUnit.decimal_precision)} ${baseLabel}`,
    sampleText: `${formatByPrecision(exampleQuantity, safePrecision)} ${unitLabel} = ${formatByPrecision(sampleConverted, baseUnit.decimal_precision)} ${baseLabel}`,
  };
}
