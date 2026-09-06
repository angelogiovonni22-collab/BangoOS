import { FilterToolbar, SearchInput, Select } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import {
  UNIT_CATEGORIES,
  UNIT_MEASUREMENT_SYSTEMS,
  UNIT_TYPES,
  type UnitCategory,
  type UnitMeasurementSystem,
  type UnitSortKey,
  type UnitType,
} from "@/lib/units-of-measure";

type UnitFiltersProps = {
  query: string;
  category: UnitCategory | "all";
  measurementSystem: UnitMeasurementSystem | "all";
  unitType: UnitType | "all";
  source: "all" | "system" | "company";
  active: "all" | "active" | "inactive";
  fractional: "all" | "fractional" | "whole_only";
  hasConversion: "all" | "with_conversion" | "without_conversion";
  baseUnitId: string;
  sortBy: UnitSortKey;
  baseUnitOptions: Array<{ id: string; code: string; name: string }>;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: UnitCategory | "all") => void;
  onMeasurementSystemChange: (value: UnitMeasurementSystem | "all") => void;
  onUnitTypeChange: (value: UnitType | "all") => void;
  onSourceChange: (value: "all" | "system" | "company") => void;
  onActiveChange: (value: "all" | "active" | "inactive") => void;
  onFractionalChange: (value: "all" | "fractional" | "whole_only") => void;
  onHasConversionChange: (value: "all" | "with_conversion" | "without_conversion") => void;
  onBaseUnitIdChange: (value: string) => void;
  onSortByChange: (value: UnitSortKey) => void;
  activeFilters: number;
};

export function UnitFilters(props: UnitFiltersProps) {
  const { locale } = useI18n();
  const es = locale === "es";
  const categoryLabels: Record<string, string> = es ? {
    count: "conteo", time: "tiempo", length: "longitud", area: "área", volume: "volumen", weight: "peso", mass: "masa", liquid: "líquido", material: "material", packaging: "empaque", equipment: "equipo", labor: "mano de obra", temperature: "temperatura", currency: "moneda", percentage: "porcentaje", other: "otro",
  } : {};
  const systemLabels: Record<string, string> = es ? { universal: "universal", imperial: "imperial", metric: "métrico", custom: "personalizado" } : {};
  const typeLabels: Record<string, string> = es ? { standard: "estándar", derived: "derivada", packaging: "empaque", custom: "personalizada" } : {};
  const label = (en: string, spanish: string) => es ? spanish : en;

  return (
    <FilterToolbar gridClassName="md:grid-cols-2 xl:grid-cols-5" footer={<p className="text-xs font-medium text-[var(--color-text-secondary)]">{label("Active filters", "Filtros activos")}: {props.activeFilters}</p>}>
      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)] xl:col-span-2">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">{label("Search", "Buscar")}</span>
        <SearchInput value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder={label("Search code, name, symbol, plural, or description", "Buscar código, nombre, símbolo, plural o descripción")} aria-label={label("Search units", "Buscar unidades")} className="h-10 py-2" />
      </label>
      <Filter label={label("Category", "Categoría")} value={props.category} onChange={(v) => props.onCategoryChange(v as UnitCategory | "all")} options={[{value:"all",label:label("All categories","Todas las categorías")}, ...UNIT_CATEGORIES.map((v) => ({value:v,label:categoryLabels[v] || v}))]} />
      <Filter label={label("Measurement System", "Sistema de medición")} value={props.measurementSystem} onChange={(v) => props.onMeasurementSystemChange(v as UnitMeasurementSystem | "all")} options={[{value:"all",label:label("All systems","Todos los sistemas")}, ...UNIT_MEASUREMENT_SYSTEMS.map((v) => ({value:v,label:systemLabels[v] || v}))]} />
      <Filter label={label("Unit Type", "Tipo de unidad")} value={props.unitType} onChange={(v) => props.onUnitTypeChange(v as UnitType | "all")} options={[{value:"all",label:label("All types","Todos los tipos")}, ...UNIT_TYPES.map((v) => ({value:v,label:typeLabels[v] || v}))]} />
      <Filter label={label("Source", "Fuente")} value={props.source} onChange={(v) => props.onSourceChange(v as "all"|"system"|"company")} options={[{value:"all",label:label("All sources","Todas las fuentes")},{value:"system",label:label("System","Sistema")},{value:"company",label:label("Company","Empresa")}]}/>
      <Filter label={label("Status", "Estado")} value={props.active} onChange={(v) => props.onActiveChange(v as "all"|"active"|"inactive")} options={[{value:"all",label:label("All statuses","Todos los estados")},{value:"active",label:label("Active only","Solo activas")},{value:"inactive",label:label("Inactive only","Solo inactivas")}]}/>
      <Filter label={label("Fractional", "Fraccionaria")} value={props.fractional} onChange={(v) => props.onFractionalChange(v as "all"|"fractional"|"whole_only")} options={[{value:"all",label:label("All","Todas")},{value:"fractional",label:label("Allows fractions","Permite fracciones")},{value:"whole_only",label:label("Whole only","Solo enteros")}]}/>
      <Filter label={label("Conversion", "Conversión")} value={props.hasConversion} onChange={(v) => props.onHasConversionChange(v as "all"|"with_conversion"|"without_conversion")} options={[{value:"all",label:label("All","Todas")},{value:"with_conversion",label:label("Has conversion","Con conversión")},{value:"without_conversion",label:label("No conversion","Sin conversión")}]}/>
      <Filter label={label("Base Unit", "Unidad base")} value={props.baseUnitId} onChange={props.onBaseUnitIdChange} options={[{value:"",label:label("All base units","Todas las unidades base")}, ...props.baseUnitOptions.map((u)=>({value:u.id,label:`${u.code} - ${u.name}`}))]}/>
      <Filter label={label("Sort by", "Ordenar por")} value={props.sortBy} onChange={(v) => props.onSortByChange(v as UnitSortKey)} options={[
        {value:"code_asc",label:label("Code (A-Z)","Código (A-Z)")},{value:"name_asc",label:label("Name (A-Z)","Nombre (A-Z)")},{value:"category_asc",label:label("Category","Categoría")},{value:"measurement_system_asc",label:label("Measurement system","Sistema de medición")},{value:"unit_type_asc",label:label("Unit type","Tipo de unidad")},{value:"is_system_desc",label:label("Source (System first)","Fuente (sistema primero)")},{value:"sort_order_asc",label:label("Sort order","Orden")},{value:"updated_at_desc",label:label("Updated (Newest)","Actualizado (más reciente)")}
      ]}/>
    </FilterToolbar>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{value:string;label:string}> }) {
  return <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]"><span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">{label}</span><Select value={value} onChange={(event)=>onChange(event.target.value)} className="h-10 py-2">{options.map((o)=><option key={o.value} value={o.value}>{o.label}</option>)}</Select></label>;
}
