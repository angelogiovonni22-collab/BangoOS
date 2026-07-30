import { Input } from "@/components/ui";
import { buildConversionPreview, type ConvertibleUnit } from "@/lib/units-of-measure";

type ConversionPreviewProps = {
  code: string;
  decimalPrecision: string;
  baseUnitId: string;
  conversionFactor: string;
  baseUnit: ConvertibleUnit | null;
  exampleQuantity: string;
  onExampleQuantityChange: (value: string) => void;
};

export function ConversionPreview({
  code,
  decimalPrecision,
  baseUnitId,
  conversionFactor,
  baseUnit,
  exampleQuantity,
  onExampleQuantityChange,
}: ConversionPreviewProps) {
  const sampleQuantity = Number(exampleQuantity);
  const safeSample = Number.isFinite(sampleQuantity) ? sampleQuantity : 5;

  const preview = buildConversionPreview(
    {
      code,
      decimalPrecision: Number(decimalPrecision) || 2,
      baseUnitId,
      conversionFactor,
    },
    baseUnit,
    safeSample,
  );

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Conversion Preview</p>
          <p className="text-xs text-[var(--color-text-secondary)]">Quantity in base unit = quantity in current unit × conversion factor</p>
        </div>

        <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
          <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Example quantity</span>
          <Input
            type="number"
            min="0"
            step="0.0001"
            value={exampleQuantity}
            onChange={(event) => onExampleQuantityChange(event.target.value)}
            className="h-10 py-2"
          />
        </label>
      </div>

      {preview.isValid ? (
        <div className="mt-3 space-y-1 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white p-3 text-sm">
          <p className="font-semibold text-[var(--color-text-primary)]">{preview.oneUnitText}</p>
          <p className="text-[var(--color-text-secondary)]">{preview.sampleText}</p>
        </div>
      ) : (
        <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-warning-200)] bg-[var(--color-warning-50)] p-3 text-sm text-[var(--color-warning-700)]">
          {preview.message}
        </div>
      )}
    </div>
  );
}
