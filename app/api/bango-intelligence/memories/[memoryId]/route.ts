import { NextRequest, NextResponse } from "next/server";
import { resolveMemoryServerContext } from "@/lib/bango-intelligence/memory/memory-server";
import type { MemoryUpdateInput } from "@/lib/bango-intelligence/memory/memory-types";

type Params = {
  params: Promise<{ memoryId: string }>;
};

export async function GET(_: NextRequest, ctx: Params): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const context = await resolveMemoryServerContext(requestId);
  if (!context.ok) {
    return NextResponse.json({ ok: false, error: context.error }, { status: context.status });
  }

  const { memoryId } = await ctx.params;
  const memory = await context.store.retrieve(context.actor, memoryId);
  if (!memory) {
    return NextResponse.json({ ok: false, error: "Memory not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, memory });
}

export async function PATCH(req: NextRequest, ctx: Params): Promise<NextResponse> {
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

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ ok: false, error: "Invalid update payload." }, { status: 400 });
  }

  try {
    const updated = await context.store.update(context.actor, memoryId, body as MemoryUpdateInput);
    return NextResponse.json({ ok: true, memory: updated });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to update memory." },
      { status: 400 },
    );
  }
}
