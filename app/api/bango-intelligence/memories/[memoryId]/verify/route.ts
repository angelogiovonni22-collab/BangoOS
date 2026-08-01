import { NextResponse } from "next/server";
import { resolveMemoryServerContext } from "@/lib/bango-intelligence/memory/memory-server";

type Params = {
  params: Promise<{ memoryId: string }>;
};

export async function POST(_: Request, ctx: Params): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const context = await resolveMemoryServerContext(requestId);
  if (!context.ok) {
    return NextResponse.json({ ok: false, error: context.error }, { status: context.status });
  }

  const { memoryId } = await ctx.params;

  try {
    const verified = await context.store.verify(context.actor, memoryId, { reason: "verified_by_authorized_user" });
    return NextResponse.json({ ok: true, memory: verified });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to verify memory." },
      { status: 400 },
    );
  }
}
