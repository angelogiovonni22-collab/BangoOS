import { NextRequest, NextResponse } from "next/server";
import { resolveMemoryServerContext } from "@/lib/bango-intelligence/memory/memory-server";
import type { MemoryRecommendationOutcomeInput } from "@/lib/bango-intelligence/memory/memory-types";

const ALLOWED_OUTCOMES = new Set(["accepted", "rejected", "implemented", "ignored", "expired"]);

type Params = {
  params: Promise<{ memoryId: string }>;
};

export async function POST(req: NextRequest, ctx: Params): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const context = await resolveMemoryServerContext(requestId);
  if (!context.ok) {
    return NextResponse.json({ ok: false, error: context.error }, { status: context.status });
  }

  const { memoryId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || typeof (body as MemoryRecommendationOutcomeInput).status !== "string") {
    return NextResponse.json({ ok: false, error: "status is required." }, { status: 400 });
  }

  const confirm = (body as { confirm?: unknown }).confirm;
  if (confirm !== true) {
    return NextResponse.json({ ok: false, error: "User confirmation is required." }, { status: 400 });
  }

  if (!ALLOWED_OUTCOMES.has((body as MemoryRecommendationOutcomeInput).status)) {
    return NextResponse.json({ ok: false, error: "Invalid recommendation outcome status." }, { status: 400 });
  }

  try {
    const updated = await context.store.recordRecommendationOutcome(
      context.actor,
      memoryId,
      body as MemoryRecommendationOutcomeInput,
    );
    return NextResponse.json({ ok: true, memory: updated });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to record recommendation outcome." },
      { status: 400 },
    );
  }
}
