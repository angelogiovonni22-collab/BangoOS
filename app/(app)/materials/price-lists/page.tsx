import { requireMaterialsAccess } from "@/lib/materials/server-access";
import { SupplierPriceListsClient } from "./supplier-price-lists-client";

export default async function SupplierPriceListsPage() {
  await requireMaterialsAccess();
  return <SupplierPriceListsClient />;
}
