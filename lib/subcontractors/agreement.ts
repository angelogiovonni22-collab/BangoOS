import { createHash } from "node:crypto";

export const MASTER_SUBCONTRACT_AGREEMENT_VERSION = "2026-08-15.1";
export const PROJECT_WORK_AUTHORIZATION_VERSION = "2026-08-15.1";

export const masterSubcontractSections = [
  ["Relationship", "Subcontractor is an independent contractor responsible for its own labor, supervision, payroll, taxes, tools, means and methods, and compliance obligations. Nothing creates an employment, partnership, joint-venture, or agency relationship."],
  ["Scope and performance", "Subcontractor shall perform only work authorized in writing by Bango Construction LLC, in a good and workmanlike manner, consistent with the project documents, applicable codes, manufacturer requirements, safety requirements, and written project instructions."],
  ["Insurance and compliance", "Before mobilization and while work is performed, Subcontractor shall maintain all insurance, workers' compensation coverage, licenses, registrations, permits, training, and certifications required by law, the project, or Bango Construction LLC, and shall provide current evidence upon request."],
  ["Safety", "Subcontractor is responsible for the safety of its employees, lower-tier subcontractors, equipment, and work areas and shall comply with applicable OSHA requirements, project safety rules, and site-specific safety instructions."],
  ["Changes", "No extra or changed work is compensable unless authorized in writing by Bango Construction LLC before the changed work is performed, except emergency work necessary to protect life or property that is promptly reported."],
  ["Payment", "Payment is governed by each Project Work Authorization and is conditioned on acceptable performance, required billing documentation, applicable lien waivers, and other project closeout requirements. Retainage, if any, will be stated in the Project Work Authorization."],
  ["Indemnity and responsibility", "To the fullest extent permitted by applicable law, each party remains responsible for its own acts and omissions. Any project-specific indemnity, defense, or additional-insured requirements must be stated in the applicable Project Work Authorization or incorporated project documents."],
  ["Warranty and correction", "Subcontractor warrants its work against defective workmanship and shall promptly correct nonconforming work for the period required by the Project Work Authorization, prime contract, or applicable law."],
  ["Default and termination", "Bango Construction LLC may suspend or terminate an authorization for material breach, unsafe conduct, failure to maintain required compliance documents, abandonment, or failure to timely cure after notice when a cure period is appropriate."],
  ["Records and flow-down", "Subcontractor shall maintain accurate project records and shall bind any approved lower-tier subcontractor to obligations applicable to its portion of the work."],
  ["Electronic signatures", "The parties consent to electronic records and signatures. A signed electronic record, together with its document hash and audit evidence, is intended to have the same effect as a signed paper counterpart."],
] as const;

export function hashSnapshot(snapshot: unknown) {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

export function buildMasterSnapshot(input: { companyName: string; vendorName: string; vendorEmail: string | null }) {
  return {
    kind: "master_subcontract_agreement",
    version: MASTER_SUBCONTRACT_AGREEMENT_VERSION,
    contractor: input.companyName,
    subcontractor: input.vendorName,
    subcontractorEmail: input.vendorEmail,
    sections: masterSubcontractSections.map(([title, body]) => ({ title, body })),
  };
}

export function buildWorkAuthorizationSnapshot(input: {
  companyName: string;
  vendorName: string;
  projectName: string;
  projectAddress: string | null;
  tradeName: string;
  scopeOfWork: string | null;
  contractAmount: number | null;
  paymentTerms: string | null;
  retainagePercent: number | null;
  startDate: string | null;
  targetCompletionDate: string | null;
}) {
  return {
    kind: "project_subcontract_work_authorization",
    version: PROJECT_WORK_AUTHORIZATION_VERSION,
    contractor: input.companyName,
    subcontractor: input.vendorName,
    project: input.projectName,
    projectAddress: input.projectAddress,
    trade: input.tradeName,
    scopeOfWork: input.scopeOfWork,
    contractAmount: input.contractAmount,
    paymentTerms: input.paymentTerms,
    retainagePercent: input.retainagePercent,
    startDate: input.startDate,
    targetCompletionDate: input.targetCompletionDate,
    terms: [
      "This Project Work Authorization incorporates the active Master Subcontract Agreement between the parties.",
      "Subcontractor shall not begin work until Bango Construction LLC marks the assignment Cleared to Mobilize in B.O.S.",
      "The stated scope, price, schedule, plans, specifications, written clarifications, approved change orders, and project-specific requirements are incorporated into this authorization.",
      "Invoices must match approved work and include required supporting documents and lien waivers when applicable.",
      "Unauthorized extra work is not compensable except emergency work necessary to protect life or property that is promptly reported.",
    ],
  };
}
