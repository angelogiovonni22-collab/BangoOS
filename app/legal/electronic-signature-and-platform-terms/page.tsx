export const metadata = {
  title: "B.O.S. Electronic Signature & Platform Terms",
  description: "Electronic records, signature, and B.O.S. platform terms for estimate review and acceptance.",
};

const sectionClass = "space-y-3";
const headingClass = "text-xl font-semibold text-slate-950";

export default function ElectronicSignaturePlatformTermsPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-10 text-slate-800 sm:px-8 sm:py-14">
      <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-950/10">
        <header className="bg-slate-950 px-6 py-8 text-white sm:px-10">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">B.O.S. legal</p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">B.O.S. Electronic Signature &amp; Platform Terms</h1>
          <p className="mt-3 text-sm text-slate-300">Version 1.0 · Effective August 14, 2026</p>
        </header>

        <div className="space-y-9 px-6 py-8 leading-7 sm:px-10">
          <section className={sectionClass}>
            <h2 className={headingClass}>1. Purpose and contracting parties</h2>
            <p>
              These terms govern the use of B.O.S. (Bango Operating System) to receive, review, retain,
              and electronically sign an estimate or agreement. The construction agreement is between the
              customer identified in the estimate and the contractor identified in that estimate. B.O.S.
              provides the technology used to deliver and record the transaction and is not an additional
              contractor, guarantor, architect, engineer, insurer, or payment obligor.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>2. Consent to electronic records</h2>
            <p>
              By selecting the consent checkbox and signing, you consent to receive the estimate, related
              disclosures, notices, and signature records electronically. You confirm that you can open,
              read, save, and print the records displayed in your browser. You may request a paper copy or
              withdraw consent before signing by contacting the contractor. Withdrawal does not affect the
              validity of records or signatures completed before withdrawal.
            </p>
            <p>
              To use electronic records, you need an internet-connected device, a current web browser,
              access to the email address where the secure link was delivered, and software capable of
              displaying and saving standard web pages or PDF documents.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>3. Intent, attribution, and authority</h2>
            <p>
              Typing your legal name, affirmatively accepting the consent statement, and selecting
              “Sign Estimate” constitutes your electronic signature and your intent to be bound by the
              estimate and incorporated terms. You represent that you are the intended recipient or are
              authorized to sign for the customer. The secure link, agreement version, timestamps, network
              information, device information, and audit events may be used to attribute and verify the
              transaction.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>4. Agreement record and corrections</h2>
            <p>
              Review the estimate carefully before signing. The signed record includes the displayed scope,
              line items, price, project terms, payment terms, and the immutable agreement version recorded
              at signature time. Contact the contractor before signing to correct an error. After signing,
              changes should be documented through a written revision or change order.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>5. B.O.S. platform role</h2>
            <p>
              The contractor remains responsible for its estimates, construction obligations, licensing,
              permits, safety, workmanship, schedules, payments, warranties, and compliance with applicable
              law. B.O.S. does not independently verify project information or provide legal, accounting,
              engineering, architectural, or insurance advice. Except for obligations that cannot lawfully
              be limited, the B.O.S. platform provider is not liable for construction performance, contractor
              or customer conduct, third-party services, or indirect, incidental, special, consequential,
              or punitive damages arising from a construction agreement.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>6. Security and availability</h2>
            <p>
              Keep the secure link confidential and notify the contractor if you believe it was accessed
              without permission. B.O.S. may use reasonable security controls, audit logs, expiration periods,
              and idempotency protections. No online service can guarantee uninterrupted or error-free
              availability, and B.O.S. may delay completion when a transaction requires fraud, integrity, or
              manual review.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>7. Governing law and preserved rights</h2>
            <p>
              These electronic-transaction terms are governed by applicable federal law and the law stated
              in the construction agreement, or Ohio law when the agreement does not specify governing law.
              Nothing here waives a non-waivable consumer right, statutory notice, cancellation right, or
              remedy. If any provision is unenforceable, the remaining provisions continue to apply.
            </p>
          </section>

          <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
            The project-specific estimate, scope, price, payment terms, warranties, notices, and cancellation
            rights control the construction relationship. Contact the contractor with project or paper-copy
            requests before signing.
          </aside>
        </div>
      </article>
    </main>
  );
}
