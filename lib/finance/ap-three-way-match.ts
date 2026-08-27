export type ThreeWayMatchStatus =
  | "matched"
  | "price_variance"
  | "quantity_variance"
  | "missing_receipt"
  | "missing_po"
  | "duplicate_invoice"
  | "needs_review";

export type ThreeWayMatchInput = {
  poQuantity: number | null;
  poUnitCost: number | null;
  receivedQuantity: number | null;
  billedQuantity: number;
  billedUnitCost: number;
  duplicateInvoice?: boolean;
  priceTolerance?: number;
  quantityTolerance?: number;
};

export type ThreeWayMatchResult = {
  status: ThreeWayMatchStatus;
  approvalReady: boolean;
  poAmount: number | null;
  receivedAmount: number | null;
  billedAmount: number;
  priceVariance: number | null;
  quantityVariance: number | null;
  blockers: string[];
};

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const qty = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000;

export function evaluateThreeWayMatch(input: ThreeWayMatchInput): ThreeWayMatchResult {
  const billedAmount = money(input.billedQuantity * input.billedUnitCost);
  const blockers: string[] = [];
  if (input.duplicateInvoice) {
    return { status: "duplicate_invoice", approvalReady: false, poAmount: null, receivedAmount: null, billedAmount, priceVariance: null, quantityVariance: null, blockers: ["Duplicate vendor invoice detected."] };
  }
  if (input.poQuantity == null || input.poUnitCost == null) {
    return { status: "missing_po", approvalReady: false, poAmount: null, receivedAmount: null, billedAmount, priceVariance: null, quantityVariance: null, blockers: ["Purchase order evidence is required."] };
  }
  const poAmount = money(input.poQuantity * input.poUnitCost);
  if (input.receivedQuantity == null) {
    return { status: "missing_receipt", approvalReady: false, poAmount, receivedAmount: null, billedAmount, priceVariance: money(input.billedUnitCost - input.poUnitCost), quantityVariance: null, blockers: ["Receiving evidence is required."] };
  }
  const priceVariance = money(input.billedUnitCost - input.poUnitCost);
  const quantityVariance = qty(input.billedQuantity - input.receivedQuantity);
  const priceTolerance = Math.max(0, input.priceTolerance ?? 0.01);
  const quantityTolerance = Math.max(0, input.quantityTolerance ?? 0.001);
  if (Math.abs(priceVariance) > priceTolerance) blockers.push(`Unit price variance: ${priceVariance.toFixed(2)}.`);
  if (Math.abs(quantityVariance) > quantityTolerance) blockers.push(`Quantity variance: ${quantityVariance.toFixed(3)}.`);
  const status: ThreeWayMatchStatus = Math.abs(priceVariance) > priceTolerance
    ? "price_variance"
    : Math.abs(quantityVariance) > quantityTolerance
      ? "quantity_variance"
      : "matched";
  return {
    status,
    approvalReady: status === "matched",
    poAmount,
    receivedAmount: money(input.receivedQuantity * input.poUnitCost),
    billedAmount,
    priceVariance,
    quantityVariance,
    blockers,
  };
}

export function summarizeBillMatch(results: ThreeWayMatchResult[]) {
  const counts = results.reduce<Record<ThreeWayMatchStatus, number>>((acc, row) => {
    acc[row.status] += 1;
    return acc;
  }, { matched: 0, price_variance: 0, quantity_variance: 0, missing_receipt: 0, missing_po: 0, duplicate_invoice: 0, needs_review: 0 });
  return {
    approvalReady: results.length > 0 && results.every((row) => row.approvalReady),
    counts,
    totalBilled: money(results.reduce((sum, row) => sum + row.billedAmount, 0)),
    blockers: results.flatMap((row) => row.blockers),
  };
}
