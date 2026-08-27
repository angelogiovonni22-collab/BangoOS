import { requireMaterialsAccess } from "@/lib/materials/server-access";
import { InventoryWorkspaceClient } from "./inventory-workspace-client";

export default async function InventoryPage() {
  await requireMaterialsAccess();
  return <InventoryWorkspaceClient />;
}
