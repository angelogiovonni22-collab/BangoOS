import { requireVendorsAccess } from "@/lib/vendors/server-access";
import { NewVendorClient } from "./vendor-new-client";

export default async function NewVendorPage() {
  await requireVendorsAccess();
  return <NewVendorClient />;
}
