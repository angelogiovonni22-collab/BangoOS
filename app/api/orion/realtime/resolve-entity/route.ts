import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

type EntityType = "customer" | "project" | "estimate" | "invoice";
type Candidate = { id: string; label: string; secondaryLabel?: string | null };

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function scoreCandidate(candidate: Candidate, phrase: string) {
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

function rank(candidates: Candidate[], phrase: string) {
  return candidates
    .map((candidate) => ({ ...candidate, score: scoreCandidate(candidate, phrase) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
    .slice(0, 5);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ ok: false, statusCategory: "workspace_unavailable", userMessage: "BOS workspace is unavailable." }, { status: 503 });
    }

    const workspace = await resolveWorkspaceContext(supabase);
    if (!workspace.context) {
      return NextResponse.json({
        ok: false,
        statusCategory: workspace.errorCode === "unauthenticated" ? "authentication_required" : "permission_denied",
        userMessage: workspace.errorMessage || "BOS workspace is unavailable.",
      }, { status: workspace.errorCode === "unauthenticated" ? 401 : 403 });
    }

    const body = await req.json() as { entityType?: unknown; phrase?: unknown };
    const entityType = typeof body.entityType === "string" ? body.entityType.trim() as EntityType : null;
    const phrase = typeof body.phrase === "string" ? body.phrase.trim() : "";
    if (!entityType || !["customer", "project", "estimate", "invoice"].includes(entityType) || !phrase) {
      return NextResponse.json({ ok: false, statusCategory: "command_validation_failed", userMessage: "Entity type and spoken name are required." }, { status: 400 });
    }

    let candidates: Candidate[] = [];
    const companyId = workspace.context.companyId;

    if (entityType === "customer") {
      const { data, error } = await supabase
        .from("customers")
        .select("id, first_name, last_name, company_name")
        .eq("company_id", companyId)
        .limit(100);
      if (error) throw new Error(error.message);
      candidates = (data || []).map((row) => {
        const personName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
        const companyName = row.company_name?.trim() || "";
        return {
          id: row.id,
          label: companyName || personName || "Customer",
          secondaryLabel: companyName && personName ? personName : null,
        };
      });
    } else if (entityType === "project") {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .eq("company_id", companyId)
        .limit(100);
      if (error) throw new Error(error.message);
      candidates = (data || []).map((row) => ({ id: row.id, label: row.name }));
    } else if (entityType === "estimate") {
      const { data, error } = await supabase
        .from("estimates")
        .select("id, estimate_number, title")
        .eq("company_id", companyId)
        .limit(100);
      if (error) throw new Error(error.message);
      candidates = (data || []).map((row) => ({
        id: row.id,
        label: row.title || row.estimate_number || "Estimate",
        secondaryLabel: row.estimate_number || null,
      }));
    } else {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, title")
        .eq("company_id", companyId)
        .limit(100);
      if (error) throw new Error(error.message);
      candidates = (data || []).map((row) => ({
        id: row.id,
        label: row.title || row.invoice_number || "Invoice",
        secondaryLabel: row.invoice_number || null,
      }));
    }

    const matches = rank(candidates, phrase);
    const exact = matches.length === 1 || (matches.length > 1 && matches[0].score >= 80 && matches[0].score > matches[1].score)
      ? matches[0]
      : null;

    return NextResponse.json({
      ok: true,
      statusCategory: exact ? "resolved" : matches.length ? "ambiguous" : "not_found",
      userMessage: exact
        ? `Resolved ${entityType} ${exact.label}.`
        : matches.length
          ? `I found ${matches.length} possible ${entityType} matches.`
          : `I couldn't find a matching ${entityType}.`,
      details: {
        entityType,
        phrase,
        resolved: exact ? { id: exact.id, label: exact.label, secondaryLabel: exact.secondaryLabel || null } : null,
        candidates: matches.map(({ score: _score, ...candidate }) => candidate),
      },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      statusCategory: "entity_resolution_failed",
      userMessage: error instanceof Error ? error.message : "Orion could not resolve that BOS record.",
    }, { status: 500 });
  }
}
