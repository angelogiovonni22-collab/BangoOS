import { EstimateDetail } from "@/components/estimates";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sendIssue?: string; createdForReview?: string }>;
};

export default async function EstimateDetailsPage({ params, searchParams }: PageProps) {
  const { id: estimateId } = await params;
  const { sendIssue, createdForReview } = await searchParams;

  if (!estimateId) {
    return null;
  }

  return (
    <div className="space-y-6">
      <EstimateDetail estimateId={estimateId} sendIssue={sendIssue} createdForReview={createdForReview === "1"} />
    </div>
  );
}
