import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const admin = createAdminClient();
  const { data: verification } = await admin.from("estimate_contract_verifications" as never).select("*").eq("token_hash", tokenHash).maybeSingle() as { data: { id: string; company_id: string; estimate_id: string; signature_id: string; expires_at: string; status: string } | null };
  if (!verification || verification.status === "expired" || new Date(verification.expires_at) <= new Date()) return NextResponse.redirect(new URL("/contracts/verified?status=invalid", request.url));

  if (verification.status !== "verified") {
    const { data: actor } = await admin.from("profiles").select("id").eq("company_id", verification.company_id).order("created_at").limit(1).maybeSingle();
    if (!actor?.id) return NextResponse.redirect(new URL("/contracts/verified?status=manual-review", request.url));
    await admin.from("estimate_signatures").update({ verification_result: "verified" }).eq("id", verification.signature_id).eq("company_id", verification.company_id);
    await admin.from("estimates").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", verification.estimate_id).eq("company_id", verification.company_id);
    const { data: conversion, error } = await admin.rpc("convert_verified_estimate_contract" as never, { p_company_id: verification.company_id, p_estimate_id: verification.estimate_id, p_signature_id: verification.signature_id, p_actor_profile_id: actor.id } as never) as { data: Array<{ project_id: string }> | null; error: { message: string } | null };
    if (error) return NextResponse.redirect(new URL("/contracts/verified?status=manual-review", request.url));
    const projectId = conversion?.[0]?.project_id || null;
    await admin.from("estimate_contract_verifications" as never).update({ status: "verified", verified_at: new Date().toISOString(), project_id: projectId } as never).eq("id", verification.id);
    return NextResponse.redirect(new URL(`/contracts/verified?status=success&project=${projectId || ""}`, request.url));
  }
  return NextResponse.redirect(new URL("/contracts/verified?status=success", request.url));
}
