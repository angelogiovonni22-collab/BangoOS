import type { Database } from "@/types/database.types";

export const VENDOR_STATUSES = ["active", "inactive", "probation", "suspended", "archived"] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export const PAYMENT_TERMS = [
  "due_on_receipt",
  "net_7",
  "net_15",
  "net_30",
  "net_45",
  "net_60",
] as const;
export type PaymentTerm = (typeof PAYMENT_TERMS)[number];

export type VendorSortKey =
  | "display_name_asc"
  | "display_name_desc"
  | "vendor_code_asc"
  | "status_asc"
  | "quality_desc"
  | "created_at_desc";

export type VendorRow = Database["public"]["Tables"]["vendors"]["Row"];

export type VendorFormInput = {
  vendor_code: string;
  company_name: string;
  display_name: string;
  status: VendorStatus;
  preferred_vendor: boolean;
  website: string;
  tax_id: string;
  account_number: string;
  payment_terms: string;
  credit_limit: string;
  billing_address: string;
  shipping_address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  first_name: string;
  last_name: string;
  title: string;
  email: string;
  phone: string;
  mobile: string;
  quality_rating: string;
  delivery_rating: string;
  notes: string;
};

export const EMPTY_VENDOR_FORM: VendorFormInput = {
  vendor_code: "",
  company_name: "",
  display_name: "",
  status: "active",
  preferred_vendor: false,
  website: "",
  tax_id: "",
  account_number: "",
  payment_terms: "net_30",
  credit_limit: "",
  billing_address: "",
  shipping_address: "",
  city: "",
  state: "",
  postal_code: "",
  country: "US",
  first_name: "",
  last_name: "",
  title: "",
  email: "",
  phone: "",
  mobile: "",
  quality_rating: "",
  delivery_rating: "",
  notes: "",
};

export type VendorListItem = {
  id: string;
  vendorCode: string;
  companyName: string;
  displayName: string;
  status: VendorStatus;
  preferredVendor: boolean;
  paymentTerms: string | null;
  contactName: string;
  email: string | null;
  phone: string | null;
  qualityRating: number | null;
  deliveryRating: number | null;
  createdAt: string;
};
