import { NextRequest, NextResponse } from "next/server";
import { resolveMemoryServerContext } from "@/lib/bango-intelligence/memory/memory-server";

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
  let reason = "archived_by_user";
  try {
    const body = await req.json();
    if (body && typeof body.reason === "string" && body.reason.trim().length > 0) {
      reason = body.reason;
    }
  } catch {
    // Accept empty body and use default reason.
  }

  try {
    const archived = await context.store.archive(context.actor, memoryId, { reason });
    return NextResponse.json({ ok: true, memory: archived });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to archive memory." },
      { status: 400 },
    );
  }
}
