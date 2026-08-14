import { requireVendorsAccess } from "@/lib/vendors/server-access";
import { VendorDetailClient } from "./vendor-detail-client";

export default async function VendorDetailPage() {
  await requireVendorsAccess();
  return <VendorDetailClient />;
}
