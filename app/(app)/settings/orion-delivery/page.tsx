"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardContent, PageHeader } from "@/components/ui";
import { useCompany } from "@/lib/company";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";

type Delivery = {
  event_id: string; status: string; attempt_count: number; next_attempt_at: string | null;
  last_attempt_at: string | null; last_error: string | null; invoice_id: string | null;
  invoice_number: string | null; can_retry: boolean; manual_retry_count: number;
};
type DeliveryData = { summary: { total: number; pending: number; delivered: number; failed: number; needsAttention: number }; rows: Delivery[] };

export default function OrionDeliveryPage() {
  const { companyId, role } = useCompany();
  const { locale } = useI18n();
  const es = locale === "es";
  if (role !== "owner" && role !== "administrator") return <p role="alert">{es ? "Se requiere acceso de administrador." : "Company administrator access is required."}</p>;
  return <DeliveryMonitor key={companyId} companyId={companyId} es={es} />;
}

function DeliveryMonitor({ companyId, es }: { companyId: string; es: boolean }) {
  const [data, setData] = useState<DeliveryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const fetchPage = useCallback(async (pageOffset: number) => {
    const client = createClient();
    if (!client) throw new Error("Unavailable");
    const result = await client.rpc("list_orion_receipt_deliveries", { p_company_id: companyId, p_offset: pageOffset });
    if (result.error) throw result.error;
    return result.data as unknown as DeliveryData;
  }, [companyId]);
  useEffect(() => {
    let active = true;
    fetchPage(0).then(result => { if (active) { setData(result); setLoading(false); } })
      .catch(() => { if (active) { setError(es ? "No se pudieron cargar las entregas. Inténtalo de nuevo." : "Unable to load deliveries. Please try again."); setLoading(false); } });
    return () => { active = false; };
  }, [fetchPage, es]);
  async function refresh(nextOffset = offset) {
    setLoading(true); setError(null);
    try { setData(await fetchPage(nextOffset)); setOffset(nextOffset); }
    catch { setError(es ? "No se pudieron cargar las entregas. Inténtalo de nuevo." : "Unable to load deliveries. Please try again."); }
    finally { setLoading(false); }
  }
  async function retry(eventId: string) {
    setBusy(eventId); setError(null); setMessage(null);
    try {
      const client = createClient();
      if (!client) throw new Error("Unavailable");
      const result = await client.rpc("retry_orion_receipt_delivery", { p_company_id: companyId, p_event_id: eventId });
      if (result.error) throw result.error;
      setMessage(result.data ? (es ? "Entrega en cola. Orion la procesará automáticamente." : "Delivery queued. Orion will process it automatically.") : (es ? "La entrega ya cambió. La lista se ha actualizado." : "The delivery has already changed. The list has been refreshed."));
      await refresh();
    } catch { setError(es ? "No se pudo confirmar el reintento. Actualiza antes de intentarlo de nuevo." : "Unable to confirm the retry. Refresh before trying again."); }
    finally { setBusy(null); }
  }
  const text = (en: string, spanish: string) => es ? spanish : en;
  const date = (value: string | null) => value ? new Date(value).toLocaleString(es ? "es" : "en-US") : "—";
  return <div className="container-wide space-y-[var(--space-section)]">
    <PageHeader compact eyebrow={text("ORION OPERATIONS", "OPERACIONES DE ORION")} title={text("Payment notification delivery", "Entrega de avisos de pago")} description={text("Monitor in-app payment confirmations. Delivery retries never record another payment.", "Supervisa los avisos de pago en la aplicación. Reintentar una entrega no registra otro pago.")} />
    <div className="flex flex-wrap gap-3"><Link href="/settings">{text("Back to Settings", "Volver a Configuración")}</Link><Button variant="outline" disabled={loading || busy !== null} onClick={() => { void refresh(); }}>{text("Refresh", "Actualizar")}</Button></div>
    {error && <p role="alert" className="text-[var(--color-danger-700)]">{error}</p>}
    {message && <p role="status">{message}</p>}
    {data && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      [text("Pending", "Pendientes"), data.summary.pending], [text("Delivered", "Entregadas"), data.summary.delivered],
      [text("Failed / retrying", "Fallidas / en reintento"), data.summary.failed], [text("Needs attention", "Requieren atención"), data.summary.needsAttention],
    ].map(([label, value]) => <Card key={label}><CardContent className="p-4"><p>{label}</p><p className="text-2xl font-bold">{value}</p></CardContent></Card>)}</div>}
    <Card><CardContent className="space-y-4 p-4">
      <p className="text-sm text-[var(--color-text-secondary)]">{text("Failed deliveries retry automatically up to five times. After correcting the cause, an administrator can queue another attempt. Previous retry requests remain audited.", "Las entregas fallidas se reintentan automáticamente hasta cinco veces. Después de corregir la causa, un administrador puede ponerlas en cola. Los reintentos manuales quedan registrados.")}</p>
      {loading ? <p role="status">{text("Loading deliveries…", "Cargando entregas…")}</p> : data?.rows.length === 0 ? <p>{text("No payment notification deliveries yet.", "Todavía no hay entregas de avisos de pago.")}</p> : data && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">{text("Payment notification deliveries", "Entregas de avisos de pago")}</caption><thead><tr>{[text("Invoice", "Factura"), text("Status", "Estado"), text("Attempts", "Intentos"), text("Last attempt / next retry", "Último intento / próximo reintento"), text("Last error", "Último error"), text("Action", "Acción")].map(h => <th key={h} scope="col" className="p-3">{h}</th>)}</tr></thead><tbody>{data.rows.map(row => <tr key={row.event_id} className="border-t border-[var(--color-border-subtle)]">
        <td className="p-3">{row.invoice_id ? <Link href={`/invoices/${row.invoice_id}`}>{row.invoice_number || text("View invoice", "Ver factura")}</Link> : text("Receipt unavailable", "Recibo no disponible")}</td>
        <td className="p-3">{row.status === "delivered" ? text("Delivered", "Entregada") : row.status === "pending" ? text("Pending", "Pendiente") : row.can_retry ? text("Needs attention", "Requiere atención") : text("Retrying", "En reintento")}</td>
        <td className="p-3">{row.attempt_count} / 5<br />{text("Manual retries", "Reintentos manuales")}: {row.manual_retry_count}</td>
        <td className="p-3">{date(row.last_attempt_at)}<br />{date(row.next_attempt_at)}</td><td className="max-w-xs break-words p-3">{row.last_error || "—"}</td>
        <td className="p-3">{row.can_retry && <Button variant="outline" disabled={busy !== null} onClick={() => { void retry(row.event_id); }}>{busy === row.event_id ? text("Queuing…", "En cola…") : text("Retry delivery", "Reintentar entrega")}</Button>}</td>
      </tr>)}</tbody></table></div>}
      {data && <div className="flex items-center gap-3"><Button variant="outline" disabled={loading || busy !== null || offset === 0} onClick={() => { void refresh(Math.max(offset - 50, 0)); }}>{text("Previous", "Anterior")}</Button><span>{Math.min(offset + 1, data.summary.total)}–{Math.min(offset + 50, data.summary.total)} / {data.summary.total}</span><Button variant="outline" disabled={loading || busy !== null || offset + 50 >= data.summary.total} onClick={() => { void refresh(offset + 50); }}>{text("Next", "Siguiente")}</Button></div>}
    </CardContent></Card>
  </div>;
}
