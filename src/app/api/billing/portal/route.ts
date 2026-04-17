import { NextRequest } from "next/server";
import { getAuthUser, requireAuth } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { getStripeConfig, toAbsoluteUrl } from "@/lib/site-settings";

function requestOrigin(request: NextRequest) {
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  const authErr = requireAuth(user);
  if (authErr) return authErr;

  if (!user!.stripeCustomerId) {
    return Response.json({ error: "No Stripe customer found for this account" }, { status: 400 });
  }

  const stripe = await getStripe();
  const stripeConfig = await getStripeConfig();
  const portal = await stripe.billingPortal.sessions.create({
    customer: user!.stripeCustomerId,
    return_url: toAbsoluteUrl(stripeConfig.portalReturnUrl, requestOrigin(request)),
  });

  return Response.json({ url: portal.url });
}
