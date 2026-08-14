import { requireVendorsAccess } from "@/lib/vendors/server-access";
import { VendorsListClient } from "./vendors-list-client";

export default async function VendorsPage() {
  await requireVendorsAccess();
  return <VendorsListClient />;
}
