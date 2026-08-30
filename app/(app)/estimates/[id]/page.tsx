import { EstimateDetail } from "@/components/estimates";
import { EstimateComplianceSection } from "@/components/estimates/estimate-compliance-section";
import { HomeSolicitationCompliancePanel } from "@/components/estimates/home-solicitation-compliance-panel";
import { HomeSolicitationSellerSignature } from "@/components/estimates/home-solicitation-seller-signature";

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
      <EstimateComplianceSection estimateId={estimateId} />
      <HomeSolicitationCompliancePanel estimateId={estimateId} />
      <HomeSolicitationSellerSignature estimateId={estimateId} />
    </div>
  );
}
