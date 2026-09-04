import { NextResponse } from "next/server";
import { checkPasswordAgainstPwnedPasswords } from "@/lib/security/password-breach";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let password = "";

  try {
    const body = await request.json() as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  if (!password) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const result = await checkPasswordAgainstPwnedPasswords(password);
  if (result.ok) return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });

  if (result.reason === "unavailable") {
    return NextResponse.json(
      { ok: false, reason: result.reason },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { ok: false, reason: result.reason },
    { status: 422, headers: { "Cache-Control": "no-store" } },
  );
}
