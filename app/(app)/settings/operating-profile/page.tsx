"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, PageHeader } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import { ADAPTIVE_BOS_TEMPLATES, type AdaptiveIndustryKey } from "@/lib/adaptive-bos/config";

type ProfileResponse = {
  ok:boolean;
  profile?:{
    industry_key?:string|null;
    industry_label?:string|null;
    business_model?:string|null;
    primary_services?:string[]|null;
  }|null;
  resolved?:{
    industryKey:AdaptiveIndustryKey;
    industryLabel:string;
    labels:Record<string,string>;
    enabledModules:string[];
    workflowHints:Record<string,string>;
  };
  error?:string;
};

const INDUSTRY_KEYS = Object.keys(ADAPTIVE_BOS_TEMPLATES) as AdaptiveIndustryKey[];

export default function OperatingProfilePage() {
  const { locale } = useI18n();
  const es = locale === "es";
  const [industryKey,setIndustryKey] = useState<AdaptiveIndustryKey>("construction");
  const [industryLabel,setIndustryLabel] = useState("");
  const [businessModel,setBusinessModel] = useState("");
  const [services,setServices] = useState("");
  const [resolved,setResolved] = useState<ProfileResponse["resolved"]>();
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");

  const template = useMemo(() => ADAPTIVE_BOS_TEMPLATES[industryKey], [industryKey]);

  useEffect(() => {
    let active = true;
    void fetch("/api/adaptive-bos/profile", { cache:"no-store" }).then(async (response) => {
      const body = await response.json() as ProfileResponse;
      if (!active) return;
      if (!response.ok || !body.ok) { setError(body.error || (es ? "No se pudo cargar el perfil operativo." : "Unable to load the operating profile.")); setLoading(false); return; }
      const selected = (body.profile?.industry_key || body.resolved?.industryKey || "construction") as AdaptiveIndustryKey;
      setIndustryKey(INDUSTRY_KEYS.includes(selected) ? selected : "generic");
      setIndustryLabel(body.profile?.industry_label || "");
      setBusinessModel(body.profile?.business_model || "");
      setServices((body.profile?.primary_services || []).join(", "));
      setResolved(body.resolved);
      setLoading(false);
    }).catch(() => { if (active) { setError(es ? "No se pudo cargar el perfil operativo." : "Unable to load the operating profile."); setLoading(false); } });
    return () => { active = false; };
  }, [es]);

  async function save() {
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/adaptive-bos/profile", {
        method:"PATCH",
        headers:{ "content-type":"application/json" },
        body:JSON.stringify({
          industry_key:industryKey,
          industry_label:industryLabel.trim() || template.label,
          business_model:businessModel.trim() || null,
          primary_services:services.split(",").map((value) => value.trim()).filter(Boolean),
        }),
      });
      const body = await response.json() as ProfileResponse;
      if (!response.ok || !body.ok) throw new Error(body.error || (es ? "No se pudo guardar." : "Unable to save."));
      setResolved(body.resolved);
      setMessage(es ? "Perfil operativo guardado. B.O.S. usará esta configuración al adaptar el espacio de trabajo." : "Operating profile saved. B.O.S. will use this configuration when adapting the workspace.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (es ? "No se pudo guardar." : "Unable to save."));
    } finally { setSaving(false); }
  }

  if (loading) return <div className="container-narrow py-8 text-[var(--color-text-secondary)]">{es ? "Cargando perfil operativo…" : "Loading operating profile…"}</div>;

  return <div className="container-narrow space-y-[var(--space-section)]">
    <PageHeader compact eyebrow={es ? "B.O.S. adaptable" : "Adaptive B.O.S."} title={es ? "Perfil operativo de la empresa" : "Company operating profile"} description={es ? "Define el tipo de empresa y los servicios principales. B.O.S. conserva los datos existentes y adapta terminología, módulos y flujos sin reconstruir tu sistema." : "Define the kind of company and its primary services. B.O.S. preserves existing data while adapting terminology, modules, and workflows without rebuilding your system."} />

    <Card as="section" variant="elevated">
      <CardHeader className="bg-[var(--color-surface-subtle)]"><CardTitle>{es ? "Industria y modelo de negocio" : "Industry and business model"}</CardTitle><p className="text-sm text-[var(--color-text-secondary)]">{es ? "La construcción sigue siendo el valor predeterminado para los espacios de trabajo existentes." : "Construction remains the default for existing workspaces."}</p></CardHeader>
      <CardContent className="space-y-5 p-5">
        <label className="block"><span className="mb-2 block text-sm font-semibold text-[var(--color-text-primary)]">{es ? "Industria" : "Industry"}</span><select value={industryKey} onChange={(event) => { const next=event.target.value as AdaptiveIndustryKey; setIndustryKey(next); setIndustryLabel(""); }} className="min-h-11 w-full rounded-[10px] border border-[var(--color-border-strong)] bg-[var(--color-surface-card)] px-3 text-[var(--color-text-primary)]">{INDUSTRY_KEYS.map((key) => <option key={key} value={key}>{ADAPTIVE_BOS_TEMPLATES[key].label}</option>)}</select></label>
        <label className="block"><span className="mb-2 block text-sm font-semibold text-[var(--color-text-primary)]">{es ? "Nombre de industria personalizado" : "Custom industry name"}</span><Input value={industryLabel} onChange={(event) => setIndustryLabel(event.target.value)} placeholder={template.label} /></label>
        <label className="block"><span className="mb-2 block text-sm font-semibold text-[var(--color-text-primary)]">{es ? "Modelo de negocio" : "Business model"}</span><Input value={businessModel} onChange={(event) => setBusinessModel(event.target.value)} placeholder={es ? "Ej. servicios recurrentes, fabricación por pedido" : "e.g. recurring services, make-to-order"} /></label>
        <label className="block"><span className="mb-2 block text-sm font-semibold text-[var(--color-text-primary)]">{es ? "Servicios principales" : "Primary services"}</span><Input value={services} onChange={(event) => setServices(event.target.value)} placeholder={es ? "Separados por comas" : "Comma-separated"} /></label>
        {error ? <div role="alert" className="rounded-[10px] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-4 py-3 text-sm font-medium text-[var(--color-danger-700)]">{error}</div> : null}
        {message ? <div role="status" className="rounded-[10px] border border-[var(--color-success-200)] bg-[var(--color-success-50)] px-4 py-3 text-sm font-medium text-[var(--color-success-700)]">{message}</div> : null}
        <Button onClick={save} disabled={saving}>{saving ? (es ? "Guardando…" : "Saving…") : (es ? "Guardar perfil operativo" : "Save operating profile")}</Button>
      </CardContent>
    </Card>

    <Card as="section" variant="elevated">
      <CardHeader className="bg-[var(--color-surface-subtle)]"><CardTitle>{es ? "Vista previa de adaptación" : "Adaptation preview"}</CardTitle><p className="text-sm text-[var(--color-text-secondary)]">{es ? "Estos son los términos y capacidades que B.O.S. resolverá para esta industria." : "These are the terms and capabilities B.O.S. resolves for this industry."}</p></CardHeader>
      <CardContent className="grid gap-5 p-5 lg:grid-cols-2">
        <div><p className="text-sm font-semibold text-[var(--color-text-primary)]">{es ? "Terminología" : "Terminology"}</p><dl className="mt-3 space-y-2 text-sm">{Object.entries((resolved?.industryKey === industryKey ? resolved.labels : template.labels)).slice(0,10).map(([key,value]) => <div key={key} className="flex justify-between gap-4 border-b border-[var(--color-border-subtle)] pb-2"><dt className="text-[var(--color-text-secondary)]">{key}</dt><dd className="font-medium text-[var(--color-text-primary)]">{value}</dd></div>)}</dl></div>
        <div><p className="text-sm font-semibold text-[var(--color-text-primary)]">{es ? "Módulos habilitados" : "Enabled modules"}</p><div className="mt-3 flex flex-wrap gap-2">{(resolved?.industryKey === industryKey ? resolved.enabledModules : template.enabledModules).map((module) => <span key={module} className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)]">{module}</span>)}</div></div>
      </CardContent>
    </Card>
  </div>;
}
