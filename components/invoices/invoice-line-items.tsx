import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui";
import { InvoiceLineItemRow } from "@/components/invoices/invoice-line-item-row";
import type { InvoiceLineItemDraft } from "@/lib/invoices/types";

export function InvoiceLineItemsSection({
  lineItems,
  localeTag,
  error,
  onChange,
}: {
  lineItems: InvoiceLineItemDraft[];
  localeTag: string;
  error?: string;
  onChange: (lineItems: InvoiceLineItemDraft[]) => void;
}) {
  function updateRow(index: number, next: InvoiceLineItemDraft) {
    const nextItems = [...lineItems];
    nextItems[index] = next;
    onChange(nextItems);
  }

  function addRow() {
    onChange([
      ...lineItems,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        sortOrder: lineItems.length,
        description: "",
        quantity: "1",
        unit: "each",
        rate: "0",
        notes: "",
      },
    ]);
  }

  function removeRow(index: number) {
    onChange(lineItems.filter((_item, rowIndex) => rowIndex !== index));
  }

  function moveRow(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;

    if (targetIndex < 0 || targetIndex >= lineItems.length) {
      return;
    }

    const nextItems = [...lineItems];
    const [moved] = nextItems.splice(index, 1);
    nextItems.splice(targetIndex, 0, moved);
    onChange(nextItems);
  }

  return (
    <Card as="section" variant="elevated">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Invoice Line Items</CardTitle>
        <Button type="button" size="sm" onClick={addRow}>Add Row</Button>
      </CardHeader>
      <CardContent className="space-y-3 overflow-x-auto">
        {error ? <p className="text-sm text-[var(--color-danger-700)]">{error}</p> : null}

        <table className="min-w-[1200px] w-full">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Quantity</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2">Rate</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Notes</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((lineItem, index) => (
              <InvoiceLineItemRow
                key={lineItem.id}
                index={index}
                item={lineItem}
                localeTag={localeTag}
                onChange={updateRow}
                onMoveUp={(rowIndex) => moveRow(rowIndex, -1)}
                onMoveDown={(rowIndex) => moveRow(rowIndex, 1)}
                onRemove={removeRow}
              />
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
