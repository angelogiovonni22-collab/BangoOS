import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type OrionResolvableEntityType = "customer" | "project" | "estimate" | "invoice";

export type OrionEntityCandidate = {
  id: string;
  label: string;
  secondaryLabel?: string | null;
};

export type OrionEntityResolution = {
  status: "resolved" | "ambiguous" | "not_found";
  resolved: OrionEntityCandidate | null;
  candidates: OrionEntityCandidate[];
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function scoreCandidate(candidate: OrionEntityCandidate, phrase: string) {
  const query = normalize(phrase);
  const label = normalize(candidate.label);
  const secondary = normalize(candidate.secondaryLabel || "");
  if (!query) return 0;
  if (label === query || secondary === query) return 100;
  if (label.startsWith(query) || secondary.startsWith(query)) return 80;
  if (label.includes(query) || secondary.includes(query)) return 60;
  const queryWords = query.split(" ").filter(Boolean);
  const haystack = `${label} ${secondary}`;
  return queryWords.reduce((score, word) => score + (haystack.includes(word) ? 10 : 0), 0);
}

function rank(candidates: OrionEntityCandidate[], phrase: string) {
  return candidates
    .map((candidate) => ({ ...candidate, score: scoreCandidate(candidate, phrase) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
    .slice(0, 5);
}

async function loadCandidates(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  entityType: OrionResolvableEntityType;
}) {
  if (params.entityType === "customer") {
    const { data, error } = await params.supabase
      .from("customers")
      .select("id, first_name, last_name, company_name")
      .eq("company_id", params.companyId)
      .limit(100);
    if (error) throw new Error(error.message);
    return (data || []).map((row) => {
      const personName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
      const companyName = row.company_name?.trim() || "";
      return {
        id: row.id,
        label: companyName || personName || "Customer",
        secondaryLabel: companyName && personName ? personName : null,
      } satisfies OrionEntityCandidate;
    });
  }

  if (params.entityType === "project") {
    const { data, error } = await params.supabase
      .from("projects")
      .select("id, name")
      .eq("company_id", params.companyId)
      .limit(100);
    if (error) throw new Error(error.message);
    return (data || []).map((row) => ({ id: row.id, label: row.name } satisfies OrionEntityCandidate));
  }

  if (params.entityType === "estimate") {
    const { data, error } = await params.supabase
      .from("estimates")
      .select("id, estimate_number, title")
      .eq("company_id", params.companyId)
      .limit(100);
    if (error) throw new Error(error.message);
    return (data || []).map((row) => ({
      id: row.id,
      label: row.title || row.estimate_number || "Estimate",
      secondaryLabel: row.estimate_number || null,
    } satisfies OrionEntityCandidate));
  }

  const { data, error } = await params.supabase
    .from("invoices")
    .select("id, invoice_number, title")
    .eq("company_id", params.companyId)
    .limit(100);
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    id: row.id,
    label: row.title || row.invoice_number || "Invoice",
    secondaryLabel: row.invoice_number || null,
  } satisfies OrionEntityCandidate));
}

export async function resolveOrionEntity(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  entityType: OrionResolvableEntityType;
  phrase: string;
}): Promise<OrionEntityResolution> {
  const phrase = params.phrase.trim();
  if (!phrase) {
    return { status: "not_found", resolved: null, candidates: [] };
  }

  const candidates = await loadCandidates(params);
  const matches = rank(candidates, phrase);
  const exact = matches.length === 1 || (matches.length > 1 && matches[0].score >= 80 && matches[0].score > matches[1].score)
    ? matches[0]
    : null;

  return {
    status: exact ? "resolved" : matches.length ? "ambiguous" : "not_found",
    resolved: exact ? { id: exact.id, label: exact.label, secondaryLabel: exact.secondaryLabel || null } : null,
    candidates: matches.map(({ score: _score, ...candidate }) => candidate),
  };
}
