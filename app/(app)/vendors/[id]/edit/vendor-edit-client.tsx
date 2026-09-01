"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { VendorForm } from "@/components/vendors";
import { Button, EmptyState, ErrorState, PageHeader, SkeletonLoader, getButtonClassName } from "@/components/ui";
import { useCompany } from "@/lib/company";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { EMPTY_VENDOR_FORM, type VendorFormInput, type VendorRow, validateVendorInput } from "@/lib/vendors";

export function EditVendorClient() {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const vendorId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const supabase = useMemo(() => createClient(), []);
  const { companyName } = useCompany();

  const [vendor, setVendor] = useState<VendorRow | null>(null);
  const [form, setForm] = useState<VendorFormInput>(EMPTY_VENDOR_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setNotFound(false);

      if (!supabase) {
        if (active) {
          setErrorMessage("Unable to connect right now. Please try again shortly.");
          setIsLoading(false);
        }
        return;
      }

      if (!vendorId) {
        if (active) {
          setErrorMessage("Unable to read vendor id.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const workspace = await resolveWorkspaceContext(supabase);

        if (!workspace.context) {
          if (active) {
            setErrorMessage(workspace.errorMessage || "Unable to verify your workspace.");
            setIsLoading(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from("vendors")
          .select("*")
          .eq("id", vendorId)
          .eq("company_id", workspace.context.companyId)
          .maybeSingle<VendorRow>();

        if (!active) {
          return;
        }

        if (error) {
          setErrorMessage(error.message);
          setIsLoading(false);
          return;
        }

        if (!data) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }

        setVendor(data);
        setForm({
          vendor_code: data.vendor_code,
          company_name: data.company_name,
          display_name: data.display_name,
          status: data.status as VendorFormInput["status"],
          preferred_vendor: data.preferred_vendor,
          website: data.website || "",
          tax_id: data.tax_id || "",
          account_number: data.account_number || "",
          payment_terms: data.payment_terms || "net_30",
          credit_limit: data.credit_limit !== null ? String(data.credit_limit) : "",
          billing_address: data.billing_address || "",
          shipping_address: data.shipping_address || "",
          city: data.city || "",
          state: data.state || "",
          postal_code: data.postal_code || "",
          country: data.country || "US",
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          title: data.title || "",
          email: data.email || "",
          phone: data.phone || "",
          mobile: data.mobile || "",
          quality_rating: data.quality_rating !== null ? String(data.quality_rating) : "",
          delivery_rating: data.delivery_rating !== null ? String(data.delivery_rating) : "",
          notes: data.notes || "",
        });
      } catch (error) {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load vendor.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [supabase, vendorId]);

  const updateField = <K extends keyof VendorFormInput>(key: K, value: VendorFormInput[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));

    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!vendor) {
      setErrorMessage("Vendor record is unavailable.");
      return;
    }

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
        updated_by: workspace.context.userId,
      };

      const { error } = await supabase
        .from("vendors")
        .update(payload)
        .eq("id", vendor.id)
        .eq("company_id", workspace.context.companyId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.push(`/vendors/${vendor.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update vendor.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonLoader className="h-8 w-80" />
        <SkeletonLoader className="h-24 w-full" />
        <SkeletonLoader className="h-64 w-full" />
      </div>
    );
  }

  if (errorMessage && !vendor) {
    return <ErrorState title="Unable to load vendor" description={errorMessage} />;
  }

  if (notFound || !vendor) {
    return (
      <EmptyState
        title="Vendor not found"
        description="This vendor could not be located in your company workspace."
        action={<Link href="/vendors" className={getButtonClassName({})}>Back to vendors</Link>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Supply Chain"
        title="Edit Vendor"
        description={`Update vendor details for ${companyName || "your company"}.`}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <VendorForm value={form} onChange={updateField} disabled={isSaving} />

        {errorMessage ? <ErrorState compact title="Unable to save vendor" description={errorMessage} /> : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href={`/vendors/${vendor.id}`}>
            <Button type="button" variant="outline" size="lg">Cancel</Button>
          </Link>
          <Button type="submit" size="lg" disabled={isSaving}>{isSaving ? "Saving..." : "Save Vendor"}</Button>
        </div>
      </form>
    </div>
  );
}
