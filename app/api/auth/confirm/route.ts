import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

const ALLOWED_TYPES = new Set<EmailOtpType>(["invite", "recovery"]);

function safeNext(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/partner/welcome";
  return value.startsWith("/partner") ? value : "/partner/welcome";
}

export async function POST(request: NextRequest) {
  let body: { tokenHash?: string; type?: string; next?: string };
  try {
    body = (await request.json()) as { tokenHash?: string; type?: string; next?: string };
  } catch {
    return NextResponse.json({ error: "Invalid confirmation request." }, { status: 400 });
  }

  const tokenHash = body.tokenHash?.trim() || "";
  const type = body.type?.trim() as EmailOtpType;
  if (!tokenHash || !ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ error: "This setup link is incomplete or invalid." }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "B.O.S. authentication is unavailable." }, { status: 503 });

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    return NextResponse.json({ error: "This setup link is invalid or has expired. Request a fresh Trade Partner invitation." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, next: safeNext(body.next) });
}
