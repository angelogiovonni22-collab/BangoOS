import { Button, Input, Select } from "@/components/ui";
import { ESTIMATE_CATEGORY_OPTIONS, ESTIMATE_UNIT_OPTIONS } from "@/lib/estimates/constants";
import { lineItemMoney } from "@/lib/estimates/calculations";
import type { EstimateLineItemDraft } from "@/lib/estimates/types";

export function EstimateLineItemRow({ index, item, localeTag, onChange, onMoveUp, onMoveDown, onRemove }: { index: number; item: EstimateLineItemDraft; localeTag: string; onChange: (index: number, next: EstimateLineItemDraft) => void; onMoveUp: (index: number) => void; onMoveDown: (index: number) => void; onRemove: (index: number) => void; }) {
  const money = lineItemMoney(item);
  const currency = new Intl.NumberFormat(localeTag, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <tr data-orion-line-item-row={index}>
      <td className="px-3 py-2"><Input data-orion-line-item-field="itemCode" value={item.itemCode} onChange={(event) => onChange(index, { ...item, itemCode: event.target.value })} placeholder="CC-001" /></td>
      <td className="px-3 py-2"><Select data-orion-line-item-field="category" value={item.category} onChange={(event) => onChange(index, { ...item, category: event.target.value as EstimateLineItemDraft["category"] })}>{ESTIMATE_CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></td>
      <td className="px-3 py-2 min-w-72"><Input data-orion-line-item-field="description" value={item.description} onChange={(event) => onChange(index, { ...item, description: event.target.value })} placeholder="Describe scope and materials" /></td>
      <td className="px-3 py-2 w-28"><Input data-orion-line-item-field="quantity" type="number" min={0} step="0.01" value={item.quantity} onChange={(event) => onChange(index, { ...item, quantity: event.target.value })} /></td>
      <td className="px-3 py-2 w-40"><Select data-orion-line-item-field="unit" value={item.unit} onChange={(event) => onChange(index, { ...item, unit: event.target.value as EstimateLineItemDraft["unit"] })}>{ESTIMATE_UNIT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></td>
      <td className="px-3 py-2 w-36"><Input data-orion-line-item-field="unitCost" type="number" min={0} step="0.01" value={item.unitCost} onChange={(event) => onChange(index, { ...item, unitCost: event.target.value })} /></td>
      <td className="px-3 py-2 w-36"><Input data-orion-line-item-field="markupPercent" type="number" min={0} step="0.01" value={item.markupPercent} onChange={(event) => onChange(index, { ...item, markupPercent: event.target.value })} /></td>
      <td className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">{currency.format(money.unitPrice)}</td>
      <td className="px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)]">{currency.format(money.lineTotal)}</td>
      <td className="px-3 py-2 min-w-64"><Input data-orion-line-item-field="notes" value={item.notes} onChange={(event) => onChange(index, { ...item, notes: event.target.value })} placeholder="Optional notes" /></td>
      <td className="px-3 py-2"><div className="flex gap-1"><Button type="button" size="sm" variant="secondary" aria-label="Move line item up" onClick={() => onMoveUp(index)}>↑</Button><Button type="button" size="sm" variant="secondary" aria-label="Move line item down" onClick={() => onMoveDown(index)}>↓</Button><Button type="button" size="sm" variant="danger" aria-label="Remove line item" onClick={() => onRemove(index)}>Remove</Button></div></td>
    </tr>
  );
}
