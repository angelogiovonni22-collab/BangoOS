import type { ContractComplianceStatus } from "./contract-compliance";

export type HomeSolicitationLocation =
  | "buyer_residence"
  | "seller_place_of_business"
  | "other_away_from_business"
  | "remote"
  | "unknown";

export type HomeSolicitationInput = {
  purchasePrice: number;
  consumerPurpose: "yes" | "no" | "unknown";
  solicitationLocation: HomeSolicitationLocation;
  buyerInitiatedContact: boolean | null;
  sellerHasFixedOhioBusiness: boolean | null;
  entirelyMailOrPhoneBuyerInitiatedNoPriorContact: boolean;
  finalAgreementAfterPriorNegotiationsAtSellerBusiness: boolean;
  emergencyHandwrittenWaiver: boolean;
  federalRescissionRightApplies: boolean | null;
  sellerName?: string | null;
  sellerAddress?: string | null;
  cancellationEmail?: string | null;
  cancellationFax?: string | null;
  noticeTemplateReady?: boolean;
  duplicateNoticeConfigured?: boolean;
  signedSellerCopyConfigured?: boolean;
  assistedLiveSigning?: boolean;
  oralDisclosureWorkflowConfirmed?: boolean;
  workStartHoldConfigured?: boolean;
};

export type HomeSolicitationCheck = {
  id: string;
  label: string;
  status: "PASS" | "FAIL" | "REVIEW" | "NOT_APPLICABLE";
  reason?: string;
};

export type HomeSolicitationEvaluation = {
  rulesetId: "OH_HOME_SOLICITATION_SALE";
  rulesetVersion: "2026-08-14.1";
  jurisdiction: "OH";
  status: ContractComplianceStatus;
  applicable: boolean | null;
  statutoryReferences: string[];
  checks: HomeSolicitationCheck[];
};

const REFERENCES = ["ORC 1345.21", "ORC 1345.22", "ORC 1345.23"];

function present(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function pass(id: string, label: string): HomeSolicitationCheck {
  return { id, label, status: "PASS" };
}

function fail(id: string, label: string, reason: string): HomeSolicitationCheck {
  return { id, label, status: "FAIL", reason };
}

function review(id: string, label: string, reason: string): HomeSolicitationCheck {
  return { id, label, status: "REVIEW", reason };
}

function na(id: string, label: string, reason: string): HomeSolicitationCheck {
  return { id, label, status: "NOT_APPLICABLE", reason };
}

function result(applicable: boolean | null, checks: HomeSolicitationCheck[]): HomeSolicitationEvaluation {
  const hasFail = checks.some((check) => check.status === "FAIL");
  const hasReview = checks.some((check) => check.status === "REVIEW");
  return {
    rulesetId: "OH_HOME_SOLICITATION_SALE",
    rulesetVersion: "2026-08-14.1",
    jurisdiction: "OH",
    status: hasFail ? "ACTION_REQUIRED" : hasReview ? "REVIEW_REQUIRED" : "COMPLIANT",
    applicable,
    statutoryReferences: REFERENCES,
    checks,
  };
}

export function evaluateOhioHomeSolicitation(input: HomeSolicitationInput): HomeSolicitationEvaluation {
  const checks: HomeSolicitationCheck[] = [];

  if (input.purchasePrice < 25) {
    checks.push(na("minimum_price", "$25 minimum purchase price", "The total purchase price is less than $25."));
    return result(false, checks);
  }

  if (input.consumerPurpose === "no") {
    checks.push(na("consumer_purpose", "Personal/family/household purpose", "The transaction is not primarily for personal, family, or household purposes."));
    return result(false, checks);
  }

  if (input.consumerPurpose === "unknown") {
    checks.push(review("consumer_purpose", "Personal/family/household purpose", "B.O.S. cannot determine whether the goods or services are primarily for personal, family, or household purposes."));
    return result(null, checks);
  }
  checks.push(pass("consumer_purpose", "Personal/family/household purpose"));

  if (input.entirelyMailOrPhoneBuyerInitiatedNoPriorContact) {
    checks.push(na("mail_phone_exclusion", "Buyer-initiated mail/phone exclusion", "The transaction is represented as entirely mail/phone, buyer-initiated, with no prior seller contact."));
    return result(false, checks);
  }

  if (input.finalAgreementAfterPriorNegotiationsAtSellerBusiness) {
    checks.push(na("retail_business_exclusion", "Prior negotiation at seller business exclusion", "The final agreement is represented as following prior negotiations at the seller's fixed retail business."));
    return result(false, checks);
  }

  if (input.buyerInitiatedContact === true && input.sellerHasFixedOhioBusiness === true) {
    checks.push(na("buyer_initiated_fixed_business_exclusion", "Buyer-initiated fixed-business exclusion", "The buyer initiated the contact for negotiation and the seller has a fixed Ohio business where the services are regularly offered."));
    return result(false, checks);
  }

  if (input.emergencyHandwrittenWaiver) {
    checks.push(review("emergency_waiver", "Emergency handwritten waiver", "The emergency exclusion requires a separate dated and signed statement in the buyer's handwriting. B.O.S. requires human review of that evidence."));
    return result(null, checks);
  }

  if (input.federalRescissionRightApplies === true) {
    checks.push(na("federal_rescission", "Federal rescission exclusion", "The transaction is represented as carrying the federal rescission right described in ORC 1345.21(A)(7)."));
    return result(false, checks);
  }

  if (input.federalRescissionRightApplies === null) {
    checks.push(review("federal_rescission", "Federal rescission exclusion", "B.O.S. cannot determine whether a separate federal rescission right applies."));
  }

  if (input.solicitationLocation === "seller_place_of_business") {
    checks.push(na("location", "Home-solicitation location", "The agreement is represented as being made at the seller's place of business."));
    return result(false, checks);
  }

  if (input.solicitationLocation === "unknown" || input.solicitationLocation === "remote") {
    checks.push(review("location", "Home-solicitation location", "The transaction location/context is not sufficient to determine whether the Ohio home-solicitation rules apply."));
    return result(null, checks);
  }

  if (input.buyerInitiatedContact === null || input.sellerHasFixedOhioBusiness === null) {
    checks.push(review("contact_origin", "Contact origin and seller business location", "B.O.S. needs the contact-origin and fixed-business facts to evaluate statutory exclusions safely."));
  }

  checks.push(pass("location", "Home-solicitation location"));

  checks.push(present(input.sellerName) ? pass("seller_name", "Seller name") : fail("seller_name", "Seller name", "The written agreement/notice needs the seller's name."));
  checks.push(present(input.sellerAddress) ? pass("seller_address", "Seller address") : fail("seller_address", "Seller address", "The written agreement/notice needs the seller's address."));
  checks.push(input.noticeTemplateReady === true ? pass("notice_template", "Cancellation notice template") : fail("notice_template", "Cancellation notice template", "The required cancellation notice language/form is not configured."));
  checks.push(input.duplicateNoticeConfigured === true ? pass("duplicate_notice", "Duplicate cancellation notices") : fail("duplicate_notice", "Duplicate cancellation notices", "The workflow must provide the required cancellation notice in duplicate."));
  checks.push(input.signedSellerCopyConfigured === true ? pass("seller_signed_copy", "Seller-signed contract copy") : fail("seller_signed_copy", "Seller-signed contract copy", "The workflow must provide the buyer a copy signed by the seller."));
  checks.push(input.workStartHoldConfigured === true ? pass("work_start_hold", "Three-business-day work-start hold") : fail("work_start_hold", "Three-business-day work-start hold", "B.O.S. must prevent service performance during the statutory cancellation period when applicable."));

  if (input.assistedLiveSigning === true && input.oralDisclosureWorkflowConfirmed === true) {
    checks.push(pass("oral_disclosure", "Oral cancellation disclosure at signing"));
  } else {
    checks.push(review("oral_disclosure", "Oral cancellation disclosure at signing", "ORC 1345.23 requires the buyer to be informed orally of the cancellation right at signing. Unattended electronic signing cannot be treated as automatically satisfying that requirement."));
  }

  if (!present(input.cancellationEmail) && !present(input.cancellationFax) && !present(input.sellerAddress)) {
    checks.push(fail("cancellation_contact", "Cancellation delivery contact", "At least one valid seller address, email address, or fax number must be available for cancellation notices."));
  } else {
    checks.push(pass("cancellation_contact", "Cancellation delivery contact"));
  }

  return result(true, checks);
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (7 + weekday - first.getUTCDay()) % 7;
  return new Date(Date.UTC(year, month, 1 + offset + (nth - 1) * 7));
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number) {
  const last = new Date(Date.UTC(year, month + 1, 0));
  const offset = (7 + last.getUTCDay() - weekday) % 7;
  return new Date(Date.UTC(year, month, last.getUTCDate() - offset));
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function ohioHomeSolicitationHolidayKeys(year: number) {
  return new Set([
    `${year}-01-01`,
    dateKey(nthWeekdayOfMonth(year, 0, 1, 3)),
    dateKey(nthWeekdayOfMonth(year, 1, 1, 3)),
    dateKey(lastWeekdayOfMonth(year, 4, 1)),
    `${year}-06-19`,
    `${year}-07-04`,
    dateKey(nthWeekdayOfMonth(year, 8, 1, 1)),
    dateKey(nthWeekdayOfMonth(year, 9, 1, 2)),
    `${year}-11-11`,
    dateKey(nthWeekdayOfMonth(year, 10, 4, 4)),
    `${year}-12-25`,
  ]);
}

export function isOhioHomeSolicitationBusinessDay(date: Date) {
  if (date.getUTCDay() === 0) return false;
  return !ohioHomeSolicitationHolidayKeys(date.getUTCFullYear()).has(dateKey(date));
}

export function calculateOhioHomeSolicitationDeadline(transactionDate: string) {
  const start = new Date(`${transactionDate.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(start.getTime())) throw new Error("Invalid transaction date.");

  let counted = 0;
  const cursor = new Date(start);
  while (counted < 3) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isOhioHomeSolicitationBusinessDay(cursor)) counted += 1;
  }
  return dateKey(cursor);
}
