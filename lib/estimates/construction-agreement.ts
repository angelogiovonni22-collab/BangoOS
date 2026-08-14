export const CONSTRUCTION_AGREEMENT_VERSION = "OH-RC-1.0";
export const BOS_ELECTRONIC_TERMS_VERSION = "1.0";

export type ConstructionAgreementSection = {
  id: string;
  title: string;
  paragraphs: string[];
};

/**
 * Original, plain-language baseline terms for Ohio residential construction.
 * Project-specific terms, mandatory statutory notices, and non-waivable rights
 * always control. This is intentionally not copied from AIA or ConsensusDocs.
 */
export const constructionAgreementSections: ConstructionAgreementSection[] = [
  {
    id: "parties-documents",
    title: "Parties, property, and contract documents",
    paragraphs: [
      "This agreement is between the customer identified in the estimate (Owner) and the construction company identified above (Contractor). It applies to the project property and work described in the estimate.",
      "The contract documents consist of the accepted estimate, scope, inclusions, exclusions, line items, project-specific terms, approved plans or specifications expressly incorporated by reference, written change orders, required statutory notices, and this Construction Agreement. A later signed change order controls only the subject it changes. Non-waivable law controls over every contract document.",
    ],
  },
  {
    id: "scope-price-payment",
    title: "Scope, price, and payment",
    paragraphs: [
      "Contractor will furnish the labor, supervision, materials, and services expressly listed in the accepted estimate. Work not reasonably included in that written scope is excluded unless added by a written change order.",
      "Owner will pay the contract price and approved change-order amounts according to the displayed payment terms. Contractor may request payment only for amounts authorized by the contract and applicable law. Deposits, retainage, financing, late charges, and payment milestones apply only when stated in the project-specific terms.",
    ],
  },
  {
    id: "schedule-delays",
    title: "Schedule and delays",
    paragraphs: [
      "Any stated start or completion date is subject to permitting, inspections, material availability, weather, concealed conditions, approved changes, events beyond reasonable control, and Owner-caused delay. Contractor will use commercially reasonable efforts to communicate material schedule changes. An extension must be reasonable in relation to the cause of delay.",
    ],
  },
  {
    id: "changes-conditions",
    title: "Changes and unforeseen conditions",
    paragraphs: [
      "Changes to scope, price, material, or time should be documented in a written change order accepted by both parties before changed work begins, except emergency work reasonably necessary to protect people or property. Nothing authorizes excess charges without the approval required by Ohio law.",
      "Concealed utilities, structural defects, hazardous materials, code deficiencies, subsurface conditions, or other conditions not reasonably observable when priced may require a change order or suspension while the parties determine a lawful response.",
    ],
  },
  {
    id: "responsibilities",
    title: "Project responsibilities",
    paragraphs: [
      "Contractor is responsible for construction means, methods, sequencing, jobsite safety for its work, workmanship, cleanup, and permits or inspections assigned to Contractor in the project terms. Contractor may use qualified subcontractors and remains responsible for its contractual work.",
      "Owner will provide lawful site access, timely selections and decisions, available utilities when stated, and accurate information about known hazards, utilities, restrictions, and existing conditions. Owner will secure valuables, occupants, and pets away from active work areas.",
    ],
  },
  {
    id: "materials-warranty",
    title: "Materials, workmanship, and warranty",
    paragraphs: [
      "Materials will be new unless the contract states otherwise. Reasonably equivalent substitutions require notice and any approval required by the contract. Manufacturer warranties pass through to Owner to the extent transferable.",
      "Contractor will perform in a workmanlike manner and honor the written project warranty and warranties required by law. Warranty coverage does not extend to ordinary wear, abuse, lack of maintenance, Owner-supplied materials, work altered by others, or pre-existing conditions, except where law provides otherwise.",
    ],
  },
  {
    id: "insurance-risk",
    title: "Insurance and property protection",
    paragraphs: [
      "Contractor will maintain insurance required by applicable law and the project terms. Each party is responsible for loss caused by its negligence or breach to the extent permitted by law. No provision requires either party to indemnify another beyond what Ohio law permits.",
    ],
  },
  {
    id: "suspension-termination",
    title: "Suspension and termination",
    paragraphs: [
      "After legally required notice and opportunity to cure, Contractor may suspend work for material nonpayment, unsafe conditions, denied access, or material Owner breach. Either party may terminate for an uncured material breach. Owner remains responsible for properly performed work, approved materials, reasonable demobilization, and other amounts lawfully due, less applicable credits.",
    ],
  },
  {
    id: "claims-law",
    title: "Claims, Ohio law, and preserved rights",
    paragraphs: [
      "The parties should first give prompt written notice of a dispute and attempt a good-faith project-level resolution. Any further procedure stated in the project-specific terms applies only to the extent enforceable. Ohio law governs Ohio projects unless non-waivable law requires otherwise.",
      "For a residential construction defect claim, Ohio Revised Code Chapter 1312 may require advance written notice and an opportunity for the contractor to inspect and offer to repair or resolve the claimed defect before litigation or arbitration. This agreement does not shorten or waive a statutory period, cancellation right, lien right, consumer remedy, or other non-waivable protection.",
    ],
  },
  {
    id: "electronic-entire-agreement",
    title: "Electronic signature and entire agreement",
    paragraphs: [
      "The parties agree that electronic records and signatures may be used. B.O.S. (Bango Operating System) provides secure delivery and signature-record technology; it is not the contractor, a party to the construction agreement, or a guarantor of construction performance.",
      "The contract documents are the entire agreement about the work and replace prior discussions on the same subject. A waiver must be explicit and applies only to that instance. If a provision is unenforceable, the remaining provisions continue. Statutory disclosures and project-specific written terms supplement these baseline terms and control when they are more protective or specific.",
    ],
  },
];

