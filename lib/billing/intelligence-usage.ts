export type BosIntelligenceProduct =
  | "orion_text"
  | "orion_voice"
  | "orion_document"
  | "orion_autonomous_action"
  | "blueprint_native_analysis"
  | "blueprint_vision_analysis"
  | "blueprint_3d_reconstruction"
  | "blueprint_visual_mockup";

export type BosUsageOutcome = "succeeded" | "customer_canceled" | "bos_failed";

export type BosUsageQuote = {
  product: BosIntelligenceProduct;
  quantity: number;
  credits: number;
  customerChargeCents: number;
  estimatedProviderCostMicros: number;
  estimatedMarginCents: number;
  billable: boolean;
  requiresConfirmation: boolean;
};

export const BOS_INTELLIGENCE_PRODUCTS: Readonly<Record<BosIntelligenceProduct, {
  label: string;
  unit: "action" | "minute" | "page" | "floor" | "mockup";
  creditsPerUnit: number;
}>> = {
  orion_text: { label: "Orion text action", unit: "action", creditsPerUnit: 1 },
  orion_voice: { label: "Orion voice minute", unit: "minute", creditsPerUnit: 2 },
  orion_document: { label: "Orion document intelligence", unit: "page", creditsPerUnit: 2 },
  orion_autonomous_action: { label: "Orion completed autonomous action", unit: "action", creditsPerUnit: 5 },
  blueprint_native_analysis: { label: "Blueprint native analysis", unit: "page", creditsPerUnit: 1 },
  blueprint_vision_analysis: { label: "Blueprint advanced vision analysis", unit: "page", creditsPerUnit: 5 },
  blueprint_3d_reconstruction: { label: "Blueprint validated 3D reconstruction", unit: "floor", creditsPerUnit: 10 },
  blueprint_visual_mockup: { label: "Blueprint presentation mockup", unit: "mockup", creditsPerUnit: 10 },
};

export function quoteBosIntelligenceUsage(input: {
  product: BosIntelligenceProduct;
  quantity?: number;
  pricePerCreditCents: number;
  estimatedProviderCostMicros?: number;
  internalNonBillable?: boolean;
}): BosUsageQuote {
  const quantity = Math.max(1, Math.ceil(input.quantity ?? 1));
  const definition = BOS_INTELLIGENCE_PRODUCTS[input.product];
  const credits = definition.creditsPerUnit * quantity;
  const billable = !input.internalNonBillable;
  const customerChargeCents = billable ? credits * Math.max(0, Math.round(input.pricePerCreditCents)) : 0;
  const estimatedProviderCostMicros = Math.max(0, Math.round(input.estimatedProviderCostMicros ?? 0));
  const estimatedMarginCents = customerChargeCents - Math.ceil(estimatedProviderCostMicros / 10_000);
  return {
    product: input.product,
    quantity,
    credits,
    customerChargeCents,
    estimatedProviderCostMicros,
    estimatedMarginCents,
    billable,
    requiresConfirmation: billable && customerChargeCents > 0,
  };
}

export function settledCreditDelta(quote: BosUsageQuote, outcome: BosUsageOutcome) {
  return quote.billable && outcome === "succeeded" ? -quote.credits : 0;
}
