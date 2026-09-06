import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Eye, Pencil } from "lucide-react";
import { Button, EnterpriseTable, EnterpriseTableBody, EnterpriseTableCell, EnterpriseTableFooter, EnterpriseTableHead, EnterpriseTableHeading, EnterpriseTableRow, StatusBadge, TableContainer, IconLink } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import type { UnitListItem } from "@/lib/units-of-measure";
import { UnitCategoryBadge } from "./unit-category-badge";
import { UnitSystemBadge } from "./unit-system-badge";

type UnitTableProps = { items: UnitListItem[]; total: number; page: number; pageSize: number; onPageChange: (page: number) => void; };

function formatConversion(item: UnitListItem) {
  if (!item.base_unit_id || !item.conversion_factor || !item.baseUnitCode) return "-";
  return `1 ${item.code} = ${item.conversion_factor} ${item.baseUnitCode}`;
}

export function UnitTable({ items, total, page, pageSize, onPageChange }: UnitTableProps) {
  const router = useRouter();
  const { locale } = useI18n();
  const es = locale === "es";
  const l = (en: string, spanish: string) => es ? spanish : en;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = total === 0 ? 0 : Math.min(total, page * pageSize);
  const canPrev = page > 1;
  const canNext = page < totalPages;
  const systemLabels: Record<string,string> = es ? { universal:"universal", imperial:"imperial", metric:"métrico", custom:"personalizado" } : {};
  const typeLabels: Record<string,string> = es ? { standard:"estándar", derived:"derivada", packaging:"empaque", custom:"personalizada" } : {};

  return (
    <TableContainer title={l("Units of Measure", "Unidades de medida")} description={l("Centralized system and company unit library.", "Biblioteca centralizada de unidades del sistema y de la empresa.")}>
      <EnterpriseTable ariaLabel={l("Units of measure table", "Tabla de unidades de medida")}>
        <EnterpriseTableHead><tr>
          <EnterpriseTableHeading>{l("Code","Código")}</EnterpriseTableHeading><EnterpriseTableHeading>{l("Name","Nombre")}</EnterpriseTableHeading><EnterpriseTableHeading>{l("Symbol","Símbolo")}</EnterpriseTableHeading><EnterpriseTableHeading>{l("Category","Categoría")}</EnterpriseTableHeading><EnterpriseTableHeading>{l("Measurement","Medición")}</EnterpriseTableHeading><EnterpriseTableHeading>{l("Unit Type","Tipo de unidad")}</EnterpriseTableHeading><EnterpriseTableHeading>{l("Base Unit","Unidad base")}</EnterpriseTableHeading><EnterpriseTableHeading>{l("Conversion","Conversión")}</EnterpriseTableHeading><EnterpriseTableHeading align="right">{l("Precision","Precisión")}</EnterpriseTableHeading><EnterpriseTableHeading>{l("Source","Fuente")}</EnterpriseTableHeading><EnterpriseTableHeading>{l("Status","Estado")}</EnterpriseTableHeading><EnterpriseTableHeading>{l("Updated","Actualizado")}</EnterpriseTableHeading><EnterpriseTableHeading align="right">{l("Actions","Acciones")}</EnterpriseTableHeading>
        </tr></EnterpriseTableHead>
        <EnterpriseTableBody>{items.map((item) => (
          <EnterpriseTableRow key={item.id} className="cursor-pointer" role="link" tabIndex={0} aria-label={`${l("Open unit","Abrir unidad")} ${item.code}`} onClick={(event) => { const target = event.target as HTMLElement; if (target.closest("a,button,input,select,textarea")) return; router.push(`/units-of-measure/${item.id}`); }} onKeyDown={(event) => { if (event.key !== "Enter" && event.key !== " ") return; event.preventDefault(); router.push(`/units-of-measure/${item.id}`); }}>
            <EnterpriseTableCell>{item.code}</EnterpriseTableCell>
            <EnterpriseTableCell><p className="text-sm font-semibold text-[var(--color-text-primary)]">{item.name}</p><p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{item.plural_name || "-"}</p></EnterpriseTableCell>
            <EnterpriseTableCell>{item.symbol || "-"}</EnterpriseTableCell>
            <EnterpriseTableCell><UnitCategoryBadge category={item.category as never} /></EnterpriseTableCell>
            <EnterpriseTableCell>{systemLabels[item.measurement_system] || item.measurement_system}</EnterpriseTableCell>
            <EnterpriseTableCell>{typeLabels[item.unit_type] || item.unit_type}</EnterpriseTableCell>
            <EnterpriseTableCell>{item.baseUnitCode ? `${item.baseUnitCode} - ${item.baseUnitName || ""}` : "-"}</EnterpriseTableCell>
            <EnterpriseTableCell>{formatConversion(item)}</EnterpriseTableCell><EnterpriseTableCell align="right">{item.decimal_precision}</EnterpriseTableCell><EnterpriseTableCell><UnitSystemBadge isSystem={item.is_system} /></EnterpriseTableCell><EnterpriseTableCell><StatusBadge status={item.is_active ? "active" : "inactive"} /></EnterpriseTableCell><EnterpriseTableCell>{new Date(item.updated_at).toLocaleDateString(es ? "es-US" : "en-US")}</EnterpriseTableCell>
            <EnterpriseTableCell align="right"><div className="inline-flex items-center gap-1"><IconLink href={`/units-of-measure/${item.id}`} icon={<Eye size={15} />} label={l("View unit","Ver unidad")} variant="ghost" size="sm" />{item.is_system ? <span className="text-xs text-[var(--color-text-muted)]">{l("System","Sistema")}</span> : <IconLink href={`/units-of-measure/${item.id}/edit`} icon={<Pencil size={15} />} label={l("Edit unit","Editar unidad")} variant="ghost" size="sm" />}</div></EnterpriseTableCell>
          </EnterpriseTableRow>
        ))}</EnterpriseTableBody>
      </EnterpriseTable>
      <EnterpriseTableFooter><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-[var(--color-text-secondary)]">{l("Showing","Mostrando")} {showingFrom}-{showingTo} {l("of","de")} {total}</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={!canPrev}><ChevronLeft size={14} />{l("Previous","Anterior")}</Button><span className="inline-flex min-w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)]">{page}</span><Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={!canNext}>{l("Next","Siguiente")}<ChevronRight size={14} /></Button></div></div></EnterpriseTableFooter>
    </TableContainer>
  );
}
