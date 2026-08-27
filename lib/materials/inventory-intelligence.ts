export type InventoryMovementType = "receive" | "allocate" | "consume" | "return" | "transfer" | "adjust";

export type InventoryBalance = {
  materialId: string;
  locationId: string;
  onHand: number;
  reserved: number;
  reorderPoint: number;
  unitCost: number;
};

export type InventoryMovement = {
  type: InventoryMovementType;
  quantity: number;
};

export function availableQuantity(balance: InventoryBalance) {
  return Math.max(0, balance.onHand - balance.reserved);
}

export function inventoryValue(balance: InventoryBalance) {
  return balance.onHand * balance.unitCost;
}

export function applyInventoryMovement(balance: InventoryBalance, movement: InventoryMovement) {
  if (!Number.isFinite(movement.quantity) || movement.quantity <= 0) {
    return { ok: false as const, balance, blocker: "Inventory movement quantity must be greater than zero." };
  }

  let onHand = balance.onHand;
  let reserved = balance.reserved;
  if (movement.type === "receive" || movement.type === "return") onHand += movement.quantity;
  if (movement.type === "allocate") {
    if (movement.quantity > availableQuantity(balance)) return { ok: false as const, balance, blocker: "Allocation exceeds available inventory." };
    reserved += movement.quantity;
  }
  if (movement.type === "consume") {
    if (movement.quantity > onHand || movement.quantity > reserved) return { ok: false as const, balance, blocker: "Consumption exceeds reserved or on-hand inventory." };
    onHand -= movement.quantity;
    reserved -= movement.quantity;
  }
  if (movement.type === "adjust") return { ok: false as const, balance, blocker: "Adjustments require an explicit signed quantity and audit reason." };
  if (movement.type === "transfer") return { ok: false as const, balance, blocker: "Transfers must be posted as an atomic source/destination pair." };

  return { ok: true as const, balance: { ...balance, onHand, reserved }, blocker: null };
}

export function inventoryHealth(balance: InventoryBalance) {
  const available = availableQuantity(balance);
  if (available <= 0) return "out" as const;
  if (available <= balance.reorderPoint) return "low" as const;
  return "healthy" as const;
}

export function reorderSuggestion(balance: InventoryBalance, targetStock: number) {
  const available = availableQuantity(balance);
  return inventoryHealth(balance) === "healthy" ? 0 : Math.max(0, targetStock - available);
}
