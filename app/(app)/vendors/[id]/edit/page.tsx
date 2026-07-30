import { requireVendorsAccess } from "@/lib/vendors/server-access";
import { EditVendorClient } from "./vendor-edit-client";

export default async function EditVendorPage() {
  await requireVendorsAccess();
  return <EditVendorClient />;
}
