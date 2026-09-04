import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type CheckResult = { status: "pass" | "fail"; latencyMs: number };
const CHECK_TIMEOUT_MS = 5_000;

async function runCheck(check: () => Promise<unknown>): Promise<CheckResult> {
  const startedAt = performance.now();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      check(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("health-check-timeout")), CHECK_TIMEOUT_MS);
      }),
    ]);
    return { status: "pass", latencyMs: Math.round(performance.now() - startedAt) };
  } catch {
    return { status: "fail", latencyMs: Math.round(performance.now() - startedAt) };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function GET() {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { status: "degraded", checks: { application: { status: "pass", latencyMs: 0 }, database: { status: "fail", latencyMs: 0 }, storage: { status: "fail", latencyMs: 0 } } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const [database, storage] = await Promise.all([
    runCheck(async () => {
      const { error } = await admin.from("companies").select("id").limit(1);
      if (error) throw error;
    }),
    runCheck(async () => {
      const { error } = await admin.storage.listBuckets();
      if (error) throw error;
    }),
  ]);
  const healthy = database.status === "pass" && storage.status === "pass";
  const payload = {
    status: healthy ? "healthy" : "degraded",
    checks: { application: { status: "pass", latencyMs: 0 }, database, storage },
    deployment: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "local",
    checkedAt: new Date().toISOString(),
  };

  if (!healthy) console.error(JSON.stringify({ event: "bos.health.degraded", ...payload }));
  return NextResponse.json(payload, { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
