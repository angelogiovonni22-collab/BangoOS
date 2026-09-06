import Link from "next/link";

export const metadata = {
  title: "Account deletion | B.O.S.",
  description: "Request deletion of your B.O.S. account and associated personal data.",
};

export default function AccountDeletionPublicPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">Bango Operating System</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">Request account deletion</h1>
        <p className="mt-4 text-base leading-7 text-slate-700">
          You can request deletion of your B.O.S. account and personal data from your account settings. B.O.S. will verify the request and remove account data that is not required to be retained for legitimate legal, security, fraud-prevention, billing, or recordkeeping obligations.
        </p>
        <p className="mt-4 text-base leading-7 text-slate-700">
          If you have an active subscription, company ownership responsibilities, or records that must be retained, B.O.S. may require those items to be resolved before final deletion is completed. The request itself can still be initiated at any time.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/settings/account-deletion" className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800">
            Sign in and request deletion
          </Link>
          <Link href="/login" className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
            Sign in to B.O.S.
          </Link>
        </div>
      </div>
    </main>
  );
}
