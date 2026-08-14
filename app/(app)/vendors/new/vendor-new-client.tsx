"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { VendorForm } from "@/components/vendors";
import { Button, ErrorState, PageHeader } from "@/components/ui";
import { useCompany } from "@/lib/company";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { EMPTY_VENDOR_FORM, type VendorFormInput, validateVendorInput } from "@/lib/vendors";

export function NewVendorClient() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { companyName } = useCompany();

  const [form, setForm] = useState<VendorFormInput>(EMPTY_VENDOR_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateField = <K extends keyof VendorFormInput>(key: K, value: VendorFormInput[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));

    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const validation = validateVendorInput(form);

    if (!validation.isValid) {
      setErrorMessage(validation.errors[0] || "Please review the form.");
      return;
    }

    if (!supabase) {
      setErrorMessage("Unable to connect right now. Please try again shortly.");
      return;
    }

    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const workspace = await resolveWorkspaceContext(supabase);

      if (!workspace.context) {
        setErrorMessage(workspace.errorMessage || "Unable to verify your workspace.");
        return;
      }

      const payload = {
        company_id: workspace.context.companyId,
        vendor_code: form.vendor_code.trim(),
        company_name: form.company_name.trim(),
        display_name: form.display_name.trim(),
        status: form.status,
        preferred_vendor: form.preferred_vendor,
        website: form.website.trim() || null,
        tax_id: form.tax_id.trim() || null,
        account_number: form.account_number.trim() || null,
        payment_terms: form.payment_terms.trim() || null,
        credit_limit: form.credit_limit.trim() ? Number(form.credit_limit) : null,
        billing_address: form.billing_address.trim() || null,
        shipping_address: form.shipping_address.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        postal_code: form.postal_code.trim() || null,
        country: form.country.trim() || null,
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        title: form.title.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        mobile: form.mobile.trim() || null,
        quality_rating: form.quality_rating.trim() ? Number(form.quality_rating) : null,
        delivery_rating: form.delivery_rating.trim() ? Number(form.delivery_rating) : null,
        notes: form.notes.trim() || null,
        created_by: workspace.context.userId,
        updated_by: workspace.context.userId,
      };

      const { data, error } = await supabase
        .from("vendors")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (!data?.id) {
        setErrorMessage("Vendor was created but the redirect target was not returned.");
        return;
      }

      router.push(`/vendors/${data.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create vendor.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Supply Chain"
        title="New Vendor"
        description={`Create a new vendor profile for ${companyName || "your company"}.`}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <VendorForm value={form} onChange={updateField} disabled={isSaving} />

        {errorMessage ? <ErrorState compact title="Unable to save vendor" description={errorMessage} /> : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href="/vendors">
            <Button type="button" variant="outline" size="lg">Cancel</Button>
          </Link>
          <Button type="submit" size="lg" disabled={isSaving}>{isSaving ? "Saving..." : "Create Vendor"}</Button>
        </div>
      </form>
    </div>
  );
}
