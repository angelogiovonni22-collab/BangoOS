import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type VerificationRecord = {
  id: string;
  company_id: string;
  estimate_id: string;
  signature_id: string;
  expires_at: string;
  status: string;
  project_id?: string | null;
};

function tokenFromRequest(request: Request) {
  return new URL(request.url).searchParams.get("token")?.trim() || "";
}

async function loadVerification(request: Request) {
  const token = tokenFromRequest(request);
  if (!token) return { admin: createAdminClient(), token, verification: null as VerificationRecord | null };
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const admin = createAdminClient();
  const { data } = await admin
    .from("estimate_contract_verifications" as never)
    .select("id,company_id,estimate_id,signature_id,expires_at,status,project_id")
    .eq("token_hash", tokenHash)
    .maybeSingle() as { data: VerificationRecord | null };
  return { admin, token, verification: data };
}

function invalidOrExpired(verification: VerificationRecord | null) {
  return !verification || verification.status === "expired" || new Date(verification.expires_at) <= new Date();
}

function confirmationHtml(request: Request) {
  const action = new URL(request.url);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirm Contract Verification</title></head><body style="margin:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#172033"><main style="max-width:620px;margin:64px auto;padding:0 20px"><section style="background:#fff;border:1px solid #dce4ee;border-radius:16px;padding:32px"><div style="font-size:24px;font-weight:800">B.O.S.</div><h1 style="font-size:24px;margin:24px 0 12px">Confirm your contract verification</h1><p style="line-height:1.6;color:#4b5a70">For your security, opening this link does not finalize anything. Select the button below to confirm that you intended to verify the signed agreement.</p><form method="post" action="${action.pathname}${action.search}"><button type="submit" style="border:0;border-radius:9px;background:#1479e8;color:#fff;font-weight:700;font-size:15px;padding:13px 22px;cursor:pointer">Confirm Verification</button></form></section></main></body></html>`;
}

export async function GET(request: Request) {
  const { verification } = await loadVerification(request);
  if (invalidOrExpired(verification)) {
    return NextResponse.redirect(new URL("/contracts/verified?status=invalid", request.url));
  }
  if (verification?.status === "verified") {
    return NextResponse.redirect(new URL(`/contracts/verified?status=success&project=${verification.project_id || ""}`, request.url));
  }
  if (verification?.status === "manual_review") {
    return NextResponse.redirect(new URL("/contracts/verified?status=manual-review", request.url));
  }

  // GET is deliberately read-only. Corporate email scanners routinely pre-open links;
  // requiring an explicit POST prevents a scanner from verifying a signature and
  // creating a project on the customer's behalf.
  return new NextResponse(confirmationHtml(request), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}

export async function POST(request: Request) {
  const { admin, verification } = await loadVerification(request);
  if (invalidOrExpired(verification)) {
    return NextResponse.redirect(new URL("/contracts/verified?status=invalid", request.url));
  }
  if (!verification) {
    return NextResponse.redirect(new URL("/contracts/verified?status=invalid", request.url));
  }
  if (verification.status === "verified") {
    return NextResponse.redirect(new URL(`/contracts/verified?status=success&project=${verification.project_id || ""}`, request.url));
  }
  if (verification.status !== "pending") {
    return NextResponse.redirect(new URL("/contracts/verified?status=manual-review", request.url));
  }

  const { data: company } = await admin
    .from("companies")
    .select("owner_id")
    .eq("id", verification.company_id)
    .maybeSingle();
  if (!company?.owner_id) {
    await admin.from("estimate_contract_verifications" as never).update({ status: "manual_review", updated_at: new Date().toISOString() } as never).eq("id", verification.id).eq("status", "pending");
    return NextResponse.redirect(new URL("/contracts/verified?status=manual-review", request.url));
  }

  const { data: actor } = await admin
    .from("profiles")
    .select("id")
    .eq("id", company.owner_id)
    .eq("company_id", verification.company_id)
    .maybeSingle();
  if (!actor?.id) {
    await admin.from("estimate_contract_verifications" as never).update({ status: "manual_review", updated_at: new Date().toISOString() } as never).eq("id", verification.id).eq("status", "pending");
    return NextResponse.redirect(new URL("/contracts/verified?status=manual-review", request.url));
  }

  const { data: signature } = await admin
    .from("estimate_signatures")
    .select("id,estimate_id,verification_result")
    .eq("id", verification.signature_id)
    .eq("company_id", verification.company_id)
    .eq("estimate_id", verification.estimate_id)
    .maybeSingle();
  if (!signature) {
    await admin.from("estimate_contract_verifications" as never).update({ status: "manual_review", updated_at: new Date().toISOString() } as never).eq("id", verification.id).eq("status", "pending");
    return NextResponse.redirect(new URL("/contracts/verified?status=manual-review", request.url));
  }

  const verifiedAt = new Date().toISOString();
  const { error: signatureError } = await admin
    .from("estimate_signatures")
    .update({ verification_result: "verified" })
    .eq("id", verification.signature_id)
    .eq("company_id", verification.company_id)
    .eq("estimate_id", verification.estimate_id);
  if (signatureError) return NextResponse.redirect(new URL("/contracts/verified?status=manual-review", request.url));

  const { error: estimateError } = await admin
    .from("estimates")
    .update({ status: "approved", approved_at: verifiedAt })
    .eq("id", verification.estimate_id)
    .eq("company_id", verification.company_id)
    .neq("status", "void");
  if (estimateError) return NextResponse.redirect(new URL("/contracts/verified?status=manual-review", request.url));

  const { data: conversion, error: conversionError } = await admin.rpc("convert_verified_estimate_contract" as never, {
    p_company_id: verification.company_id,
    p_estimate_id: verification.estimate_id,
    p_signature_id: verification.signature_id,
    p_actor_profile_id: actor.id,
  } as never) as { data: Array<{ project_id: string }> | null; error: { message: string } | null };
  if (conversionError) {
    await admin.from("estimate_contract_verifications" as never).update({ status: "manual_review", updated_at: verifiedAt } as never).eq("id", verification.id).eq("status", "pending");
    return NextResponse.redirect(new URL("/contracts/verified?status=manual-review", request.url));
  }

  const projectId = conversion?.[0]?.project_id || null;
  const { error: verificationError } = await admin
    .from("estimate_contract_verifications" as never)
    .update({ status: "verified", verified_at: verifiedAt, project_id: projectId, updated_at: verifiedAt } as never)
    .eq("id", verification.id)
    .eq("status", "pending");
  if (verificationError) return NextResponse.redirect(new URL("/contracts/verified?status=manual-review", request.url));

  return NextResponse.redirect(new URL(`/contracts/verified?status=success&project=${projectId || ""}`, request.url));
}
