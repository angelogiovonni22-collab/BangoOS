"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";

type DeletionRequest = {
  id: string;
  status: string;
  requested_at: string;
  processed_at?: string | null;
};

export default function AccountDeletionSettingsPage() {
  const { locale } = useI18n();
  const es = locale === "es";
  const [reason, setReason] = useState("");
  const [current, setCurrent] = useState<DeletionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/account/deletion-request", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load request status.");
        return response.json();
      })
      .then((payload) => {
        if (active) setCurrent(payload.request ?? null);
      })
      .catch(() => {
        if (active) setMessage(es ? "No se pudo cargar el estado de la solicitud." : "Unable to load deletion request status.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [es]);

  async function submitRequest() {
    if (submitting || current?.status === "pending") return;
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/account/deletion-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to submit request.");
      setCurrent(payload.request ?? null);
      setMessage(
        payload.alreadyPending
          ? es
            ? "Ya existe una solicitud de eliminación pendiente."
            : "A deletion request is already pending."
          : es
            ? "Solicitud de eliminación enviada."
            : "Account deletion request submitted."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : es ? "No se pudo enviar la solicitud." : "Unable to submit the request.");
    } finally {
      setSubmitting(false);
    }
  }

  const pending = current?.status === "pending";

  return (
    <div className="container-narrow space-y-[var(--space-section)]">
      <PageHeader
        compact
        eyebrow={es ? "Privacidad y cuenta" : "Privacy & account"}
        title={es ? "Eliminación de cuenta" : "Account deletion"}
        description={
          es
            ? "Inicia una solicitud para eliminar tu cuenta de B.O.S. y los datos personales asociados que no debamos conservar legalmente."
            : "Initiate a request to delete your B.O.S. account and associated personal data that B.O.S. is not required to retain."
        }
      />

      <Card as="section" variant="elevated">
        <CardHeader className="bg-[var(--color-surface-subtle)]">
          <CardTitle>{es ? "Antes de solicitar la eliminación" : "Before you request deletion"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5 text-sm text-[var(--color-text-secondary)]">
          <p>
            {es
              ? "La solicitud no elimina datos de forma inmediata. B.O.S. verificará tu identidad, obligaciones de facturación, propiedad de la empresa y cualquier requisito legítimo de retención antes de completar la eliminación."
              : "Submitting a request does not immediately delete data. B.O.S. will verify identity, billing obligations, company ownership responsibilities, and legitimate retention requirements before completing deletion."}
          </p>
          <p>
            {es
              ? "La desactivación temporal no sustituye la eliminación de cuenta. Una vez aprobada, eliminaremos los datos de la cuenta que no estemos obligados a conservar."
              : "Temporary deactivation is not a substitute for account deletion. Once approved, B.O.S. will remove account data that is not required to be retained."}
          </p>
          <Link href="/account-deletion" className="font-semibold text-[var(--color-action-primary)] hover:underline">
            {es ? "Ver información pública sobre eliminación de cuenta" : "View the public account deletion resource"}
          </Link>
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader className="bg-[var(--color-surface-subtle)]">
          <CardTitle>{es ? "Solicitar eliminación" : "Request deletion"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          {loading ? <p className="text-sm text-[var(--color-text-secondary)]">{es ? "Cargando…" : "Loading…"}</p> : null}
          {current ? (
            <div className="rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] p-4 text-sm">
              <p className="font-semibold text-[var(--color-text-primary)]">
                {es ? "Estado actual" : "Current status"}: {current.status}
              </p>
              <p className="mt-1 text-[var(--color-text-secondary)]">
                {es ? "Solicitado" : "Requested"}: {new Date(current.requested_at).toLocaleString(locale)}
              </p>
            </div>
          ) : null}

          {!pending ? (
            <label className="block">
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">{es ? "Motivo opcional" : "Optional reason"}</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={1000}
                rows={4}
                className="mt-2 w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                placeholder={es ? "Puedes indicar cualquier detalle que debamos conocer." : "Add any details you want B.O.S. to know."}
              />
            </label>
          ) : null}

          <button
            type="button"
            onClick={submitRequest}
            disabled={submitting || pending || loading}
            className="inline-flex items-center rounded-[10px] bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending
              ? es
                ? "Solicitud pendiente"
                : "Deletion request pending"
              : submitting
                ? es
                  ? "Enviando…"
                  : "Submitting…"
                : es
                  ? "Solicitar eliminación de cuenta"
                  : "Request account deletion"}
          </button>

          {message ? <p className="text-sm text-[var(--color-text-secondary)]" role="status">{message}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
