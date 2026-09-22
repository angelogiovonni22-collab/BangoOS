export const CONSTRUCTION_AGREEMENT_VERSION = "OH-RC-1.2";
export const BOS_ELECTRONIC_TERMS_VERSION = "1.1";

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
    id: "non-solicitation-non-circumvention",
    title: "Non-solicitation, non-circumvention, and workforce / trade partner protection",
    paragraphs: [
      "Owner acknowledges that Contractor invests substantial time, expense, management effort, recruiting resources, training, supervision, estimating, scheduling, project coordination, and relationship-building in its employees, subcontractors, crews, and trade partners. For this Section, Protected Personnel means an employee, superintendent, project manager, estimator, laborer, crew member, independent contractor, subcontractor, lower-tier subcontractor, consultant, or trade partner who actually performs services in connection with the Project or is specifically introduced to Owner by Contractor for the purpose of performing or pricing work on the Project.",
      "During the term of this Agreement and for twelve (12) months following the later of substantial completion, termination, cancellation, or the last material performance of work on the Project, Owner shall not knowingly, directly or indirectly, solicit, recruit, induce, encourage, hire, retain, contract with, employ, or otherwise engage Protected Personnel for the purpose of bypassing, replacing, circumventing, or interfering with Contractor's relationship with that person or entity for work on the Project, the Project property, or a specific follow-on opportunity first introduced or materially developed by Contractor.",
      "Owner shall not knowingly enter into a separate or side arrangement with Protected Personnel for work that was introduced, estimated, proposed, developed, coordinated, managed, supervised, or performed by Contractor in connection with the Project. This restriction applies regardless of how the arrangement is structured or described, including employment, subcontracting, consulting, temporary labor, side work, cash work, purchase orders, referral arrangements, joint ventures, newly formed entities, affiliate companies, related businesses, staffing arrangements, or other direct or indirect business relationships.",
      "Owner may not accomplish indirectly through another individual or entity what this Agreement prohibits directly. This includes knowingly using or directing an affiliate, related business, another contractor, consultant, staffing company, business partner, family member, owner, officer, employee, agent, representative, newly created company, or other intermediary to solicit, hire, contract with, or otherwise engage Protected Personnel in a manner prohibited by this Section. The restrictions are not avoided merely because Protected Personnel initiates contact with Owner if Owner knowingly enters into an arrangement that otherwise violates this Section.",
      "This Section does not prohibit a legitimate business relationship that Owner can reasonably demonstrate existed independently before Contractor introduced or involved that person or entity in the Project. It also does not prohibit bona fide general employment advertising, public job postings, or general recruiting efforts that are not specifically directed toward Contractor's Protected Personnel. Nothing in this Section is intended to prevent any individual from working in a chosen occupation, prohibit lawful ordinary competition, prevent unrelated work that did not arise through Contractor, or create a general restriction against working in the construction industry.",
      "Owner shall not use Contractor's non-public pricing, estimating information, subcontractor pricing, labor rates, project scope development, scheduling information, vendor information, customer information, internal documents, or other proprietary business information for the purpose of circumventing or unfairly bypassing Contractor.",
      "Owner acknowledges that a violation of this Section may cause Contractor substantial and difficult-to-measure losses, including recruiting and replacement costs, training and supervision costs, lost project margin, lost contractor markup, lost management fees, disruption, delay, administrative costs, and loss of business opportunity. If Owner breaches this Section, Contractor may bring a legal action against Owner and pursue all remedies available under applicable law, including proven monetary damages, court costs where recoverable, and temporary, preliminary, or permanent injunctive relief where legally appropriate. Owner understands that a breach may result in litigation and financial liability.",
      "Owner may directly hire, retain, or contract with Protected Personnel only with Contractor's prior written authorization signed by an authorized representative of Contractor. Contractor's failure to immediately enforce this Section in one instance is not a waiver of the right to enforce it later or in another instance; any waiver must be in writing and signed by an authorized representative of Contractor.",
      "The parties intend this Section to be enforced only to the maximum extent permitted by Ohio law. If any restriction is determined to be broader than legally enforceable, the parties intend that it be limited or enforced to the maximum lawful extent rather than invalidating the entire Section, to the extent permitted by applicable law. If any portion is invalid or unenforceable, the remaining provisions continue to the fullest extent permitted by law. The obligations in this Section survive completion, termination, expiration, or cancellation of this Agreement for the stated twelve (12) month protection period.",
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
    id: "ohio-defect-notice",
    title: "IMPORTANT OHIO CONSTRUCTION DEFECT NOTICE",
    paragraphs: [
      "OHIO LAW CONTAINS IMPORTANT REQUIREMENTS YOU MUST FOLLOW BEFORE YOU MAY FILE A LAWSUIT OR COMMENCE ARBITRATION PROCEEDINGS FOR DEFECTIVE CONSTRUCTION AGAINST THE RESIDENTIAL CONTRACTOR WHO CONSTRUCTED YOUR HOME. AT LEAST SIXTY DAYS BEFORE YOU FILE A LAWSUIT OR COMMENCE ARBITRATION PROCEEDINGS, YOU MUST PROVIDE THE CONTRACTOR WITH A WRITTEN NOTICE OF THE CONDITIONS YOU ALLEGE ARE DEFECTIVE. UNDER CHAPTER 1312 OF THE OHIO REVISED CODE, THE CONTRACTOR HAS AN OPPORTUNITY TO OFFER TO REPAIR OR PAY FOR THE DEFECTS. YOU ARE NOT OBLIGATED TO ACCEPT ANY OFFER THE CONTRACTOR MAKES. THERE ARE STRICT DEADLINES AND PROCEDURES UNDER STATE LAW, AND FAILURE TO FOLLOW THEM MAY AFFECT YOUR ABILITY TO FILE A LAWSUIT OR COMMENCE ARBITRATION PROCEEDINGS.",
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

