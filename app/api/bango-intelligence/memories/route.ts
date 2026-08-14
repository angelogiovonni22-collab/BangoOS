import { NextRequest, NextResponse } from "next/server";
import { resolveMemoryServerContext } from "@/lib/bango-intelligence/memory/memory-server";
import { validateLinkedResourcesForMemoryCreate } from "@/lib/bango-intelligence/memory/memory-linked-resource-validation";
import type { MemoryCreateInput } from "@/lib/bango-intelligence/memory/memory-types";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const context = await resolveMemoryServerContext(requestId);
  if (!context.ok) {
    return NextResponse.json({ ok: false, error: context.error }, { status: context.status });
  }

  const { searchParams } = new URL(req.url);
  const categories = searchParams.get("categories")?.split(",").filter(Boolean) as MemoryCreateInput["category"][] | undefined;
  const confidence = searchParams.get("confidence")?.split(",").filter(Boolean) ?? [];
  const importance = searchParams.get("importance")?.split(",").filter(Boolean) ?? [];
  const verification = searchParams.get("verification")?.trim();

  try {
    const listed = await context.store.list(context.actor, {
      scope: (searchParams.get("scope") as MemoryCreateInput["scope"] | null) ?? undefined,
      projectId: searchParams.get("projectId") ?? undefined,
      customerId: searchParams.get("customerId") ?? undefined,
      userId: searchParams.get("userId") ?? undefined,
      taskId: searchParams.get("taskId") ?? undefined,
      phaseId: searchParams.get("phaseId") ?? undefined,
      categories,
      maxResults: Number(searchParams.get("limit") ?? "50"),
      includeArchived: searchParams.get("includeArchived") === "true",
      includeExpired: searchParams.get("includeExpired") === "true",
    });

    const records = listed.filter((record) => {
      if (confidence.length > 0 && !confidence.includes(record.confidence)) {
        return false;
      }
      if (importance.length > 0 && !importance.includes(record.importance)) {
        return false;
      }
      if (verification === "verified" && !record.verifiedAt) {
        return false;
      }
      if (verification === "unverified" && record.verifiedAt) {
        return false;
      }
      return true;
    });

    return NextResponse.json({ ok: true, records });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to list memories." },
      { status: 400 },
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const context = await resolveMemoryServerContext(requestId);
  if (!context.ok) {
    return NextResponse.json({ ok: false, error: context.error }, { status: context.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ ok: false, error: "Invalid memory payload." }, { status: 400 });
  }

  const payload = body as MemoryCreateInput;

  const linkedValidation = await validateLinkedResourcesForMemoryCreate(
    context.supabase,
    context.actor.companyId,
    payload,
  );

  if (!linkedValidation.ok) {
    return NextResponse.json({ ok: false, error: linkedValidation.error }, { status: 400 });
  }

  try {
    const result = await context.store.create(context.actor, payload);
    return NextResponse.json({ ok: true, memory: result.record, deduplicationOutcome: result.deduplicationOutcome });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to create memory." },
      { status: 400 },
    );
  }
}
