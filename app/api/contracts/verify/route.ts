import { NextResponse } from "next/server";

// B.O.S. now finalizes customer signatures through the secure estimate bearer
// link in one atomic legal transition. This legacy second-verification endpoint is
// intentionally non-operational so an old verification email cannot bypass current
// token revision, cancellation, or signature-finalization invariants.
function retiredResponse(request: Request) {
  const response = NextResponse.redirect(new URL("/contracts/verified?status=invalid", request.url), 303);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}

export async function GET(request: Request) {
  return retiredResponse(request);
}

export async function POST(request: Request) {
  return retiredResponse(request);
}
