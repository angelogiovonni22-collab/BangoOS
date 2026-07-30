import { calculateChangeOrderTotals } from "@/lib/change-orders/calculations";
import type { ChangeOrderFormErrors, ChangeOrderFormValues, ChangeOrderLineItemDraft } from "@/lib/change-orders/types";

function hasMeaningfulItem(item: ChangeOrderLineItemDraft) {
  return item.description.trim().length > 0 && Number(item.quantity || 0) > 0;
}

export function validateChangeOrderForm(
  values: ChangeOrderFormValues,
  lineItems: ChangeOrderLineItemDraft[],
): ChangeOrderFormErrors {
  const errors: ChangeOrderFormErrors = {};

  if (!values.title.trim()) {
    errors.title = "Title is required.";
  }

  if (!values.projectId) {
    errors.projectId = "Project is required.";
  }

  if (values.requestedDate && values.effectiveDate && values.effectiveDate < values.requestedDate) {
    errors.effectiveDate = "Effective date cannot be earlier than requested date.";
  }

  const scheduleImpact = Number(values.scheduleImpactDays || 0);

  if (!Number.isFinite(scheduleImpact)) {
    errors.scheduleImpactDays = "Schedule impact must be a valid number.";
  }

  if (Number(values.taxRatePercent || 0) < 0) {
    errors.taxRatePercent = "Tax rate cannot be negative.";
  }

  lineItems.forEach((lineItem, index) => {
    const quantity = Number(lineItem.quantity || 0);
    const unitCost = Number(lineItem.unitCost || 0);
    const unitPrice = Number(lineItem.unitPrice || 0);

    if (!lineItem.description.trim()) {
      errors[`lineItems.${index}`] = "Line item description is required.";
      return;
    }

    if (quantity < 0 || Number.isNaN(quantity)) {
      errors[`lineItems.${index}`] = "Quantity cannot be negative.";
      return;
    }

    if (unitCost < 0 || Number.isNaN(unitCost)) {
      errors[`lineItems.${index}`] = "Unit cost cannot be negative.";
      return;
    }

    if (unitPrice < 0 || Number.isNaN(unitPrice)) {
      errors[`lineItems.${index}`] = "Unit price cannot be negative.";
    }
  });

  if (["pending_approval", "approved", "invoiced"].includes(values.status) && !lineItems.some(hasMeaningfulItem)) {
    errors.lineItems = "At least one meaningful line item is required before submission.";
  }

  const totals = calculateChangeOrderTotals({
    lineItems,
    taxRatePercent: values.taxRatePercent,
  });

  if (totals.grandTotal < 0) {
    errors.lineItems = "Line item totals are invalid.";
  }

  return errors;
}
