import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { AppLocale } from "@/lib/i18n/config";
import { getLowesPublicReadiness } from "@/lib/materials/lowes-server-config";

const blockerTranslations: Record<string, string> = {
  "Lowe's client ID is not configured.": "El ID de cliente de Lowe's no está configurado.",
  "Lowe's client secret is not configured.": "El secreto de cliente de Lowe's no está configurado.",
  "Lowe's API base URL is not configured.": "La URL base de la API de Lowe's no está configurada.",
  "Lowe's Pro account is not linked.": "La cuenta Lowe's Pro no está vinculada.",
  "Lowe's product catalog capability is not enabled.": "La capacidad de catálogo de productos de Lowe's no está habilitada.",
  "Lowe's pricing capability is not enabled.": "La capacidad de precios de Lowe's no está habilitada.",
  "Lowe's inventory capability is not enabled.": "La capacidad de inventario de Lowe's no está habilitada.",
  "Lowe's order submission capability is not enabled.": "La capacidad de envío de pedidos de Lowe's no está habilitada.",
  "Lowe's order status capability is not enabled.": "La capacidad de estado de pedidos de Lowe's no está habilitada.",
};

export function RetailerIntegrationStatus({ locale }: { locale: AppLocale }) {
  const lowes = getLowesPublicReadiness();
  const es = locale === "es";
  const capabilities = es ? [
    ["Catálogo", lowes.catalogReady],
    ["Precios en vivo", lowes.pricingReady],
    ["Inventario", lowes.inventoryReady],
    ["Pedidos directos", lowes.orderingReady],
    ["Estado del pedido", lowes.orderStatusReady],
  ] as const : [
    ["Catalog", lowes.catalogReady],
    ["Live pricing", lowes.pricingReady],
    ["Inventory", lowes.inventoryReady],
    ["Direct ordering", lowes.orderingReady],
    ["Order status", lowes.orderStatusReady],
  ] as const;
  const environment = es ? (lowes.environment === "production" ? "producción" : "sandbox") : lowes.environment;

  return <Card>
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><CardTitle>{es ? "Integraciones con minoristas" : "Retailer Integrations"}</CardTitle><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{es ? "El comercio en vivo con proveedores amplía el flujo de compras existente de B.O.S. sin reemplazar las órdenes de compra, aprobaciones, costos de proyecto ni recepción." : "Live supplier commerce extends the existing B.O.S. purchasing workflow without replacing purchase orders, approvals, job costing, or receiving."}</p></div>
        <span className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-semibold uppercase tracking-wide">Lowe&apos;s · {environment}</span>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{capabilities.map(([label, ready]) => <div key={label} className="rounded-xl border border-[var(--color-border)] p-3"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">{label}</p><p className={`mt-1 font-semibold ${ready ? "text-emerald-600" : "text-amber-700"}`}>{ready ? (es ? "Listo" : "Ready") : (es ? "Configuración requerida" : "Configuration required")}</p></div>)}</div>
      {lowes.blockers.length ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">{es ? "Aún se requiere acceso externo" : "External access still required"}</p><ul className="mt-2 list-disc space-y-1 pl-5">{lowes.blockers.map((blocker) => <li key={blocker}>{es ? blockerTranslations[blocker] ?? blocker : blocker}</li>)}</ul><p className="mt-3">{es ? "B.O.S. no intentará realizar un pedido real a un minorista hasta que estén configuradas las capacidades y credenciales aprobadas del proveedor y una orden de compra tenga aprobación humana explícita." : "B.O.S. will not attempt a live retailer order until the approved provider capabilities and credentials are configured and a purchase order has explicit human approval."}</p></div> : <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">{es ? "La configuración de integración de Lowe's está presente. El envío real de pedidos sigue sujeto a la aprobación de órdenes de compra de B.O.S." : "Lowe's integration configuration is present. Live order submission remains subject to the B.O.S. purchase-order approval gate."}</div>}
    </CardContent>
  </Card>;
}
