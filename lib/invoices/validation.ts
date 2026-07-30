import { calculateInvoiceTotals } from "@/lib/invoices/calculations";
import type { InvoiceFormErrors, InvoiceFormValues, InvoiceLineItemDraft } from "@/lib/invoices/types";

function hasMeaningfulItem(item: InvoiceLineItemDraft) {
  return item.description.trim().length > 0 && Number(item.quantity || 0) > 0;
}

export function validateInvoiceForm(values: InvoiceFormValues, lineItems: InvoiceLineItemDraft[]): InvoiceFormErrors {
  const errors: InvoiceFormErrors = {};

  if (!values.title.trim()) {
    errors.title = "Invoice title is required.";
  }

  if (!values.customerId) {
    errors.customerId = "Customer is required.";
  }

  if (!values.issueDate) {
    errors.issueDate = "Issue date is required.";
  }

  if (!values.dueDate) {
    errors.dueDate = "Due date is required.";
  }

  if (values.dueDate && values.issueDate && values.dueDate < values.issueDate) {
    errors.dueDate = "Due date cannot be earlier than issue date.";
  }

  lineItems.forEach((lineItem, index) => {
    const quantity = Number(lineItem.quantity || 0);
    const rate = Number(lineItem.rate || 0);

    if (quantity < 0 || Number.isNaN(quantity)) {
      errors[`lineItems.${index}`] = "Quantity cannot be negative.";
    }

    if (rate < 0 || Number.isNaN(rate)) {
      errors[`lineItems.${index}`] = "Rate cannot be negative.";
    }
  });

  if (Number(values.taxRatePercent || 0) < 0) {
    errors.taxRatePercent = "Tax cannot be negative.";
  }

  const totals = calculateInvoiceTotals({
    lineItems,
    discountType: values.discountType,
    discountValue: values.discountValue,
    taxRatePercent: values.taxRatePercent,
    additionalFee: values.additionalFee,
  });

  if (totals.grandTotal < 0) {
    errors.discountValue = "Discount creates an invalid negative total.";
  }

  if (
    (values.status === "sent" || values.status === "viewed" || values.status === "partially_paid")
    && !lineItems.some((lineItem) => hasMeaningfulItem(lineItem))
  ) {
    errors.status = "At least one meaningful line item is required before sending an invoice.";
  }

  return errors;
}
