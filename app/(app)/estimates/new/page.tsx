import { EstimateForm } from "@/components/estimates";

export default async function NewEstimatePage({ searchParams }: {
  searchParams: Promise<{ customerId?: string | string[] }>;
}) {
  const { customerId } = await searchParams;
  const defaultCustomerId = typeof customerId === "string" ? customerId.trim() : undefined;
  return <EstimateForm key={defaultCustomerId || "prospect"} mode="create" defaultCustomerId={defaultCustomerId} />;
}
