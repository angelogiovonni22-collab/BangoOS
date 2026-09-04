"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type MarketType = "residential" | "commercial" | "both";
type DocumentType = "w9" | "coi" | "workers_comp" | "licenses";
type UploadedDocument = { id: string; requirementType: string; originalFilename: string; expiresAt: string | null; viewUrl: string | null };
type PartnerForm = {
  companyName: string;
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mobile: string;
  website: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  primaryTrade: string;
  marketType: MarketType;
  yearsInBusiness: string;
  crewSize: string;
  serviceArea: string;
  contractorLicense: string;
  insuranceProvider: string;
  insuranceExpiresAt: string;
};

const initialForm: PartnerForm = {
  companyName: "",
  displayName: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  mobile: "",
  website: "",
  streetAddress: "",
  city: "",
  state: "",
  postalCode: "",
  primaryTrade: "",
  marketType: "both",
  yearsInBusiness: "",
  crewSize: "",
  serviceArea: "",
  contractorLicense: "",
  insuranceProvider: "",
  insuranceExpiresAt: "",
};

const documentLabels: Record<DocumentType, string> = {
  w9: "W-9",
  coi: "Certificate of Insurance",
  workers_comp: "Workers' Compensation",
  licenses: "License / Certification",
};

type PasswordCheckReason = "length" | "complexity" | "leaked" | "unavailable" | "invalid_request";

async function screenPassword(password: string): Promise<{ ok: true } | { ok: false; reason: PasswordCheckReason }> {
  try {
    const response = await fetch("/api/security/password-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const body = await response.json() as { ok?: boolean; reason?: PasswordCheckReason };
    return body.ok ? { ok: true } : { ok: false, reason: body.reason || "unavailable" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

function passwordCheckMessage(reason: PasswordCheckReason) {
  if (reason === "length") return "Use a password with at least 12 characters.";
  if (reason === "complexity") return "Include uppercase, lowercase, a number, and a symbol.";
  if (reason === "leaked") return "That password appears in known breach data. Choose a different password.";
  return "Password safety verification is temporarily unavailable. Please try again.";
}

export default function TradePartnerWelcomePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(Boolean(supabase));
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<PartnerForm>(initialForm);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState(supabase ? "" : "B.O.S. authentication is unavailable.");

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      const signedIn = Boolean(data.user);
      setAuthenticated(signedIn);
      setChecking(false);
      if (!signedIn) return;
      setLoadingProfile(true);
      try {
        const response = await fetch("/api/trade-partners/onboarding", { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load Trade Partner profile.");
        const vendor = body.vendor || {};
        if (!active) return;
        setForm({
          companyName: vendor.company_name || "",
          displayName: vendor.display_name || "",
          firstName: vendor.first_name || "",
          lastName: vendor.last_name || "",
          email: vendor.email || data.user?.email || "",
          phone: vendor.phone || "",
          mobile: vendor.mobile || "",
          website: vendor.website || "",
          streetAddress: vendor.billing_address || "",
          city: vendor.city || "",
          state: vendor.state || "",
          postalCode: vendor.postal_code || "",
          primaryTrade: vendor.primary_trade || "",
          marketType: (["residential", "commercial", "both"].includes(vendor.market_type) ? vendor.market_type : "both") as MarketType,
          yearsInBusiness: vendor.years_in_business == null ? "" : String(vendor.years_in_business),
          crewSize: vendor.crew_size == null ? "" : String(vendor.crew_size),
          serviceArea: vendor.service_area || "",
          contractorLicense: vendor.contractor_license || "",
          insuranceProvider: vendor.insurance_provider || "",
          insuranceExpiresAt: vendor.insurance_expires_at ? String(vendor.insurance_expires_at).slice(0, 10) : "",
        });
        setDocuments(Array.isArray(body.documents) ? body.documents : []);
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Unable to load Trade Partner onboarding.");
      } finally {
        if (active) setLoadingProfile(false);
      }
    });
    return () => { active = false; };
  }, [supabase]);

  function updateField<K extends keyof PartnerForm>(field: K, value: PartnerForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    if (message) setMessage("");
  }

  function validateStep() {
    if (step === 1) {
      if (!form.companyName.trim()) return "Company name is required.";
      if (!form.firstName.trim()) return "Primary contact first name is required.";
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Enter a valid business email.";
      if (!form.state.trim()) return "State is required so B.O.S. can apply the correct jurisdiction rules.";
    }
    if (step === 2) {
      if (!form.primaryTrade.trim()) return "Primary trade is required.";
      if (form.yearsInBusiness && Number(form.yearsInBusiness) < 0) return "Years in business cannot be less than zero.";
      if (form.crewSize && Number(form.crewSize) < 1) return "Crew size must be at least 1.";
    }
    if (step === 4) {
      if (password.length < 12) return "Use a password with at least 12 characters.";
      if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) return "Include uppercase, lowercase, a number, and a symbol.";
      if (password !== confirmPassword) return "Passwords do not match.";
    }
    return "";
  }

  function nextStep() {
    const validation = validateStep();
    if (validation) { setMessage(validation); return; }
    setMessage("");
    setStep((current) => Math.min(current + 1, 4));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function previousStep() {
    setMessage("");
    setStep((current) => Math.max(current - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function uploadDocument(requirementType: DocumentType, event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setBusy(`upload:${requirementType}`);
    setMessage("");
    try {
      const payload = new FormData();
      payload.append("file", file);
      payload.append("requirementType", requirementType);
      if (requirementType === "coi" && form.insuranceExpiresAt) payload.append("expiresAt", form.insuranceExpiresAt);
      const response = await fetch("/api/trade-partners/onboarding/documents", { method: "POST", body: payload });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to upload document.");
      setDocuments((current) => [body.document, ...current.filter((item) => item.requirementType !== requirementType)]);
      setMessage(`${documentLabels[requirementType]} uploaded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload document.");
    } finally {
      setBusy(null);
    }
  }

  async function finishSetup() {
    const validation = validateStep();
    if (validation) { setMessage(validation); return; }
    if (!supabase) { setMessage("B.O.S. authentication is unavailable."); return; }

    setBusy("finish");
    setMessage("");
    try {
      const passwordCheck = await screenPassword(password);
      if (!passwordCheck.ok) throw new Error(passwordCheckMessage(passwordCheck.reason));

      const saveResponse = await fetch("/api/trade-partners/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, complete: true }),
      });
      const saveBody = await saveResponse.json();
      if (!saveResponse.ok) throw new Error(saveBody.error || "Unable to save Trade Partner profile.");

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.replace("/partner");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to finish account setup.");
    } finally {
      setBusy(null);
    }
  }

  const progress = `${step * 25}%`;
  const uploadedTypes = new Set(documents.map((item) => item.requirementType));

  return (
    <div className="container-content py-8">
      <section className="mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] shadow-[var(--shadow-card)]">
        <header className="border-b border-[var(--bos-border-default)] bg-[var(--bos-bg-root)] px-6 py-8 sm:px-10">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#74b5ff]">B.O.S. Trade Partner Onboarding</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Set Up Your Trade Partner Profile</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--bos-text-secondary)] sm:text-base">Complete the essentials once so assigned projects, plans, messages, payment applications, and compliance requirements stay connected to your company.</p>
        </header>

        <div className="px-6 py-7 sm:px-10 sm:py-9">
          <div className="mb-8">
            <div className="flex items-center justify-between gap-4 text-sm font-bold"><span>Step {step} of 4</span><span className="text-right text-[var(--bos-text-secondary)]">{step === 1 ? "Company & Contact" : step === 2 ? "Trade Profile" : step === 3 ? "Compliance Documents" : "Review & Secure Account"}</span></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--bos-bg-root)]"><div className="h-full rounded-full bg-[#2d6cf6] transition-all" style={{ width: progress }} /></div>
          </div>

          {checking || loadingProfile ? <p className="text-sm text-[var(--bos-text-secondary)]">Verifying Trade Partner profile…</p> : !authenticated ? (
            <div className="rounded-xl border border-amber-300/40 bg-amber-50 p-4 text-sm text-amber-900">This invitation session is not active. Open the newest B.O.S. invitation link from your email again.</div>
          ) : (
            <>
              {step === 1 ? <div className="space-y-6">
                <SectionIntro title="Company & contact" description="Tell B.O.S. who you are and where your company operates. Tax and jurisdiction defaults will be determined from the project and company location — no manual tax-rate setup is required." />
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Company name" value={form.companyName} onChange={(value) => updateField("companyName", value)} required /><Field label="Trade / DBA name" value={form.displayName} onChange={(value) => updateField("displayName", value)} placeholder="Optional" /></div>
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Primary contact first name" value={form.firstName} onChange={(value) => updateField("firstName", value)} required /><Field label="Primary contact last name" value={form.lastName} onChange={(value) => updateField("lastName", value)} /></div>
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Business email" type="email" value={form.email} onChange={(value) => updateField("email", value)} required /><Field label="Business phone" type="tel" value={form.phone} onChange={(value) => updateField("phone", value)} /></div>
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Mobile / emergency contact" type="tel" value={form.mobile} onChange={(value) => updateField("mobile", value)} /><Field label="Website" type="url" value={form.website} onChange={(value) => updateField("website", value)} placeholder="Optional" /></div>
                <Field label="Street address" value={form.streetAddress} onChange={(value) => updateField("streetAddress", value)} />
                <div className="grid gap-4 sm:grid-cols-3"><Field label="City" value={form.city} onChange={(value) => updateField("city", value)} /><Field label="State" value={form.state} onChange={(value) => updateField("state", value)} required /><Field label="ZIP code" value={form.postalCode} onChange={(value) => updateField("postalCode", value)} /></div>
              </div> : null}

              {step === 2 ? <div className="space-y-6">
                <SectionIntro title="Trade profile" description="Keep this short and operational. B.O.S. uses it to match your company to scopes, assignments, schedules, and compliance requirements." />
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Primary trade" value={form.primaryTrade} onChange={(value) => updateField("primaryTrade", value)} placeholder="Example: Electrical, Drywall, Plumbing" required /><Field label="Service area" value={form.serviceArea} onChange={(value) => updateField("serviceArea", value)} placeholder="Example: Columbus + 50 miles" /></div>
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Years in business" type="number" min="0" value={form.yearsInBusiness} onChange={(value) => updateField("yearsInBusiness", value)} /><Field label="Typical crew size" type="number" min="1" value={form.crewSize} onChange={(value) => updateField("crewSize", value)} /></div>
                <Field label="Contractor / trade license number" value={form.contractorLicense} onChange={(value) => updateField("contractorLicense", value)} placeholder="Optional or not applicable" />
                <div><p className="text-sm font-bold">Primary type of work</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><ChoiceCard label="Residential" description="Homes and residential remodeling" selected={form.marketType === "residential"} onClick={() => updateField("marketType", "residential")} /><ChoiceCard label="Commercial" description="Commercial and property projects" selected={form.marketType === "commercial"} onClick={() => updateField("marketType", "commercial")} /><ChoiceCard label="Both" description="Residential and commercial work" selected={form.marketType === "both"} onClick={() => updateField("marketType", "both")} /></div></div>
              </div> : null}

              {step === 3 ? <div className="space-y-6">
                <SectionIntro title="Compliance documents" description="Upload the essentials now if you have them. You can finish missing items later, but B.O.S. may block mobilization until required documents are verified for a project." />
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Insurance provider" value={form.insuranceProvider} onChange={(value) => updateField("insuranceProvider", value)} placeholder="Optional" /><Field label="Insurance expiration" type="date" value={form.insuranceExpiresAt} onChange={(value) => updateField("insuranceExpiresAt", value)} /></div>
                <div className="grid gap-3 sm:grid-cols-2">{(["w9", "coi", "workers_comp", "licenses"] as DocumentType[]).map((type) => <DocumentCard key={type} type={type} uploaded={uploadedTypes.has(type)} filename={documents.find((item) => item.requirementType === type)?.originalFilename || null} busy={busy === `upload:${type}`} onUpload={(event) => void uploadDocument(type, event)} />)}</div>
                <p className="rounded-xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-root)] px-4 py-3 text-xs leading-5 text-[var(--bos-text-secondary)]">W-9, insurance, workers&apos; compensation, and applicable licenses are the core documents. Project-specific safety acknowledgements, certified payroll, lien waivers, and closeout documents stay in the project workflow where they belong.</p>
              </div> : null}

              {step === 4 ? <div className="space-y-6">
                <SectionIntro title="Review & secure account" description="Confirm the essentials, create your password, and open your Trade Partner workspace." />
                <div className="grid gap-3 sm:grid-cols-2"><ReviewCard label="Company" value={form.displayName || form.companyName} /><ReviewCard label="Primary trade" value={form.primaryTrade} /><ReviewCard label="Work type" value={form.marketType === "both" ? "Residential & Commercial" : form.marketType.charAt(0).toUpperCase() + form.marketType.slice(1)} /><ReviewCard label="Service area" value={form.serviceArea || "Not provided"} /><ReviewCard label="W-9" value={uploadedTypes.has("w9") ? "Uploaded" : "Finish later"} /><ReviewCard label="Insurance" value={uploadedTypes.has("coi") ? "Uploaded" : "Finish later"} /><ReviewCard label="Workers' Comp" value={uploadedTypes.has("workers_comp") ? "Uploaded" : "Finish later"} /><ReviewCard label="License" value={uploadedTypes.has("licenses") ? "Uploaded" : form.contractorLicense ? "Number provided" : "Not provided"} /></div>
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Password" type="password" value={password} onChange={setPassword} required /><Field label="Confirm password" type="password" value={confirmPassword} onChange={setConfirmPassword} required /></div>
                <p className="text-xs text-[var(--bos-text-secondary)]">Use at least 12 characters with uppercase, lowercase, a number, and a symbol. B.O.S. also checks the password against known breach data before activation.</p>
              </div> : null}

              {message ? <div role="status" className="mt-6 rounded-xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-root)] px-4 py-3 text-sm font-semibold">{message}</div> : null}

              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row">{step > 1 ? <Button type="button" variant="outline" size="lg" fullWidth disabled={busy === "finish"} onClick={previousStep}>Back</Button> : null}{step < 4 ? <Button type="button" size="lg" fullWidth onClick={nextStep}>Continue</Button> : <Button type="button" size="lg" fullWidth disabled={busy === "finish"} onClick={() => void finishSetup()}>{busy === "finish" ? "Creating Trade Partner Profile…" : "Create Trade Partner Profile"}</Button>}</div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function SectionIntro({ title, description }: { title: string; description: string }) {
  return <div><h2 className="text-2xl font-black tracking-tight">{title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--bos-text-secondary)]">{description}</p></div>;
}

function Field({ label, value, onChange, type = "text", placeholder, required = false, min }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean; min?: string }) {
  const id = `partner-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return <label htmlFor={id} className="block space-y-2 text-sm font-bold">{label}{required ? <span className="ml-1 text-red-400">*</span> : null}<Input id={id} type={type} min={min} value={value} placeholder={placeholder} required={required} onChange={(event) => onChange(event.target.value)} /></label>;
}

function ChoiceCard({ label, description, selected, onClick }: { label: string; description: string; selected: boolean; onClick: () => void }) {
  return <button type="button" aria-pressed={selected} onClick={onClick} className={`rounded-2xl border px-4 py-4 text-left transition ${selected ? "border-[#3f7cff] bg-[#17345f] text-white ring-2 ring-[#3f7cff]/40" : "border-[var(--bos-border-default)] bg-[var(--bos-bg-root)] text-[var(--bos-text-primary)] hover:border-[#5b8fff] hover:bg-[var(--bos-bg-panel)]"}`}><span className="block font-black">{label}</span><span className="mt-1 block text-sm text-[var(--bos-text-secondary)]">{description}</span></button>;
}

function DocumentCard({ type, uploaded, filename, busy, onUpload }: { type: DocumentType; uploaded: boolean; filename: string | null; busy: boolean; onUpload: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return <div className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-root)] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{documentLabels[type]}</p><p className="mt-1 text-xs text-[var(--bos-text-secondary)]">{filename || (uploaded ? "Uploaded" : "Upload now or finish later")}</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${uploaded ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>{uploaded ? "Uploaded" : "Pending"}</span></div><label className="mt-4 block cursor-pointer rounded-lg border border-[var(--bos-border-default)] px-3 py-2 text-center text-xs font-black hover:border-[#5b8fff]"><input className="sr-only" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" disabled={busy} onChange={onUpload} />{busy ? "Uploading…" : uploaded ? "Replace document" : "Upload document"}</label></div>;
}

function ReviewCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-root)] px-4 py-3"><p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--bos-text-secondary)]">{label}</p><p className="mt-1 font-bold">{value}</p></div>;
}
