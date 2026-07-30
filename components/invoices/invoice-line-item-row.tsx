import { Button, Input, Select } from "@/components/ui";
import { INVOICE_UNIT_OPTIONS } from "@/lib/invoices/constants";
import { invoiceLineItemMoney } from "@/lib/invoices/calculations";
import type { InvoiceLineItemDraft } from "@/lib/invoices/types";

export function InvoiceLineItemRow({
  index,
  item,
  localeTag,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  index: number;
  item: InvoiceLineItemDraft;
  localeTag: string;
  onChange: (index: number, next: InvoiceLineItemDraft) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  const money = invoiceLineItemMoney(item);
  const currency = new Intl.NumberFormat(localeTag, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <tr>
      <td className="px-3 py-2 min-w-72"><Input value={item.description} onChange={(event) => onChange(index, { ...item, description: event.target.value })} placeholder="Work description" /></td>
      <td className="px-3 py-2 w-28"><Input type="number" min={0} step="0.01" value={item.quantity} onChange={(event) => onChange(index, { ...item, quantity: event.target.value })} /></td>
      <td className="px-3 py-2 w-40">
        <Select value={item.unit} onChange={(event) => onChange(index, { ...item, unit: event.target.value as InvoiceLineItemDraft["unit"] })}>
          {INVOICE_UNIT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Select>
      </td>
      <td className="px-3 py-2 w-36"><Input type="number" min={0} step="0.01" value={item.rate} onChange={(event) => onChange(index, { ...item, rate: event.target.value })} /></td>
      <td className="px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)]">{currency.format(money.amount)}</td>
      <td className="px-3 py-2 min-w-64"><Input value={item.notes} onChange={(event) => onChange(index, { ...item, notes: event.target.value })} placeholder="Optional note" /></td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <Button type="button" size="sm" variant="secondary" aria-label="Move line item up" onClick={() => onMoveUp(index)}>↑</Button>
          <Button type="button" size="sm" variant="secondary" aria-label="Move line item down" onClick={() => onMoveDown(index)}>↓</Button>
          <Button type="button" size="sm" variant="danger" aria-label="Remove line item" onClick={() => onRemove(index)}>Remove</Button>
        </div>
      </td>
    </tr>
  );
}
