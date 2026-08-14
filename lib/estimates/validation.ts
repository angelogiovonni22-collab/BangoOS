import { calculateEstimateTotals } from "@/lib/estimates/calculations";
import type { EstimateFormErrors, EstimateFormValues, EstimateLineItemDraft } from "@/lib/estimates/types";

function hasMeaningfulItem(item: EstimateLineItemDraft) {
  return item.description.trim().length > 0 && Number(item.quantity || 0) > 0;
}

export function validateEstimateForm(values: EstimateFormValues, lineItems: EstimateLineItemDraft[]): EstimateFormErrors {
  const errors: EstimateFormErrors = {};

  if (!values.title.trim()) {
    errors.title = "Estimate name is required.";
  }

  if (!values.customerId) {
    errors.customerId = "Customer is required.";
  }

  if (!values.issueDate) {
    errors.issueDate = "Estimate date is required.";
  }

  if (values.expirationDate && values.issueDate && values.expirationDate < values.issueDate) {
    errors.expirationDate = "Expiration date cannot be earlier than estimate date.";
  }

  lineItems.forEach((lineItem, index) => {
    const quantity = Number(lineItem.quantity || 0);
    const unitCost = Number(lineItem.unitCost || 0);
    const markup = Number(lineItem.markupPercent || 0);

    if (quantity < 0 || Number.isNaN(quantity)) {
      errors[`lineItems.${index}`] = "Quantity cannot be negative.";
    }

    if (unitCost < 0 || Number.isNaN(unitCost)) {
      errors[`lineItems.${index}`] = "Unit cost cannot be negative.";
    }

    if (markup < 0 || Number.isNaN(markup)) {
      errors[`lineItems.${index}`] = "Markup cannot be negative.";
    }
  });

  const totals = calculateEstimateTotals({
    lineItems,
    discountType: values.discountType,
    discountValue: values.discountValue,
    taxRatePercent: values.taxRatePercent,
    additionalFee: values.additionalFee,
  });

  if (Number(values.taxRatePercent || 0) < 0) {
    errors.taxRatePercent = "Tax cannot be negative.";
  }

  if (totals.grandTotal < 0) {
    errors.discountValue = "Discount creates an invalid negative total.";
  }

  if (
    (values.status === "sent" || values.status === "approved")
    && !lineItems.some((lineItem) => hasMeaningfulItem(lineItem))
  ) {
    errors.status = "At least one meaningful line item is required before sending or approving.";
  }

  return errors;
}
