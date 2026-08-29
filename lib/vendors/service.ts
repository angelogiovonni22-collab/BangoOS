import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";

type VendorRow = Database["public"]["Tables"]["vendors"]["Row"] & {
  performance_rating?: number | null;
  performance_review_count?: number | null;
  rehire_status?: string | null;
};

type VendorsServiceDeps = {
  supabaseClient?: ReturnType<typeof createClient>;
  resolveWorkspace?: typeof resolveWorkspaceContext;
};

export type VendorOption = {
  id: string;
  companyName: string;
  displayName: string;
  contactName: string;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  paymentTerms: string | null;
  performanceRating: number | null;
  performanceReviewCount: number;
  rehireStatus: "approved" | "review_before_assignment" | "do_not_rehire";
};

export class VendorsServiceError extends Error {
  readonly code: "CONTEXT" | "PERSISTENCE";

  constructor(code: VendorsServiceError["code"], message: string) {
    super(message);
    this.name = "VendorsServiceError";
    this.code = code;
  }
}

export type VendorsService = {
  listVendorOptions: () => Promise<VendorOption[]>;
};

function toVendorOption(row: VendorRow): VendorOption {
  const firstName = row.first_name?.trim() || "";
  const lastName = row.last_name?.trim() || "";
  const rehire = row.rehire_status || "approved";
  return {
    id: row.id,
    companyName: row.company_name,
    displayName: row.display_name,
    contactName: [firstName, lastName].filter(Boolean).join(" "),
    phone: row.phone,
    mobile: row.mobile,
    email: row.email,
    paymentTerms: row.payment_terms,
    performanceRating: row.performance_rating == null ? null : Number(row.performance_rating),
    performanceReviewCount: Number(row.performance_review_count || 0),
    rehireStatus: (["approved", "review_before_assignment", "do_not_rehire"].includes(rehire) ? rehire : "approved") as VendorOption["rehireStatus"],
  };
}

export function createVendorsService(deps: VendorsServiceDeps = {}): VendorsService {
  const supabase = deps.supabaseClient ?? createClient();
  const resolveWorkspace = deps.resolveWorkspace ?? resolveWorkspaceContext;

  return {
    async listVendorOptions() {
      const workspace = await resolveWorkspace(supabase);

      if (!workspace.context) {
        throw new VendorsServiceError("CONTEXT", workspace.errorMessage || "Unable to resolve workspace context.");
      }

      if (!supabase) {
        throw new VendorsServiceError("PERSISTENCE", "Unable to connect to storage.");
      }

      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("company_id", workspace.context.companyId)
        .order("display_name", { ascending: true });

      if (error) {
        throw new VendorsServiceError("PERSISTENCE", "Unable to load vendors right now.");
      }

      return (data ?? []).map((row) => toVendorOption(row as VendorRow));
    },
  };
}
