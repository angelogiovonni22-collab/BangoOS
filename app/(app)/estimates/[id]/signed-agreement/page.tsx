import { SignedAgreementViewer } from "@/components/estimates/signed-agreement-viewer";

type PageProps = { params: Promise<{ id: string }> };

export default async function SignedAgreementPage({ params }: PageProps) {
  const { id } = await params;
  if (!id) return null;
  return <SignedAgreementViewer estimateId={id} />;
}
