export default async function ContractVerifiedPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const success = status === "success";
  return <main className="mx-auto max-w-2xl p-6 sm:p-12"><div className={`rounded-3xl border p-8 ${success ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><h1 className="text-3xl font-bold">{success ? "Contract verified" : "Verification needs attention"}</h1><p className="mt-3 text-slate-700">{success ? "Your signature is verified and BOS has created the project. The contractor has been notified." : "This verification link is invalid, expired, or requires manual review. Please contact the contractor for a new link."}</p></div></main>;
}
