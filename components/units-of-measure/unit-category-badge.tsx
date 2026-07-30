import { Badge } from "@/components/ui";
import type { UnitCategory } from "@/lib/units-of-measure";

const CATEGORY_LABELS: Record<UnitCategory, string> = {
  count: "Count",
  time: "Time",
  length: "Length",
  area: "Area",
  volume: "Volume",
  weight: "Weight",
  mass: "Mass",
  liquid: "Liquid",
  material: "Material",
  packaging: "Packaging",
  equipment: "Equipment",
  labor: "Labor",
  temperature: "Temperature",
  currency: "Currency",
  percentage: "Percentage",
  other: "Other",
};

export function UnitCategoryBadge({ category }: { category: UnitCategory }) {
  return <Badge tone="info">{CATEGORY_LABELS[category]}</Badge>;
}
