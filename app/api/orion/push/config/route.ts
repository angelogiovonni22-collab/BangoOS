import { NextResponse } from "next/server";

export async function GET() {
  const publicKey = process.env.ORION_VAPID_PUBLIC_KEY?.trim() || "";
  if (!publicKey) {
    return NextResponse.json({ ok: false, error: "Orion background notifications are not configured yet." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, publicKey });
}
