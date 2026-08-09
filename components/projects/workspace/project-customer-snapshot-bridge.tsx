"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { ProjectCustomerSnapshot } from "./project-customer-snapshot";

type SnapshotState = {
  loaded: boolean;
  jobSiteName: string;
  address: string;
  contactName: string;
  phone: string;
  email: string;
};

export function ProjectCustomerSnapshotBridge({ projectId, projectName }: { projectId: string; projectName: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<SnapshotState | null>(null);

  useEffect(() => {
    let subscribed = true;

    const load = async () => {
      const workspace = await resolveWorkspaceContext(supabase);
      if (!supabase || !workspace.context) return;

      const projectResponse = await supabase
        .from("projects")
        .select("name, customer_id, address_line_1, address_line_2, city, state, postal_code")
        .eq("company_id", workspace.context.companyId)
        .eq("id", projectId)
        .maybeSingle<{
          name: string | null;
          customer_id: string | null;
          address_line_1: string | null;
          address_line_2: string | null;
          city: string | null;
          state: string | null;
          postal_code: string | null;
        }>();

      if (projectResponse.error || !projectResponse.data || !subscribed) return;

      const project = projectResponse.data;
      const address = [project.address_line_1, project.address_line_2, project.city, project.state, project.postal_code]
        .map((value) => value?.trim())
        .filter(Boolean)
        .join(", ");
      let contactName = "Not linked";
      let phone = "Not provided";
      let email = "Not provided";

      if (project.customer_id) {
        const customerResponse = await supabase
          .from("customers")
          .select("first_name, last_name, company_name, phone, email")
          .eq("company_id", workspace.context.companyId)
          .eq("id", project.customer_id)
          .maybeSingle<{
            first_name: string | null;
            last_name: string | null;
            company_name: string | null;
            phone: string | null;
            email: string | null;
          }>();

        if (!customerResponse.error && customerResponse.data) {
          const customer = customerResponse.data;
          contactName = customer.company_name?.trim()
            || `${customer.first_name?.trim() || ""} ${customer.last_name?.trim() || ""}`.trim()
            || "Linked customer";
          phone = customer.phone?.trim() || phone;
          email = customer.email?.trim() || email;
        }
      }

      if (subscribed) {
        setState({
          loaded: true,
          jobSiteName: project.name?.trim() || projectName,
          address: address || "Not provided",
          contactName,
          phone,
          email,
        });
      }
    };

    void load();
    return () => {
      subscribed = false;
    };
  }, [projectId, projectName, supabase]);

  if (!state?.loaded) return null;

  return (
    <ProjectCustomerSnapshot
      jobSiteName={state.jobSiteName}
      address={state.address}
      primaryContactName={state.contactName}
      primaryContactPhone={state.phone}
      primaryContactEmail={state.email}
    />
  );
}
