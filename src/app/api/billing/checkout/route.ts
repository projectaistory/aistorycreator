import { NextRequest } from "next/server";
import { getAuthUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { getStripeConfig, toAbsoluteUrl } from "@/lib/site-settings";

type CheckoutBody = {
  planId?: unknown;
  interval?: unknown;
};

function requestOrigin(request: NextRequest) {
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  const authErr = requireAuth(user);
  if (authErr) return authErr;

  let body: CheckoutBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const planId = typeof body.planId === "string" ? body.planId : "";
  const interval = body.interval === "month" || body.interval === "year" ? body.interval : "";
  if (!planId || !interval) {
    return Response.json({ error: "planId and interval are required" }, { status: 400 });
  }

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      name: true,
      monthlyPriceId: true,
      yearlyPriceId: true,
      monthlyPrice: true,
      yearlyPrice: true,
    },
  });
  if (!plan) {
    return Response.json({ error: "Plan not found" }, { status: 404 });
  }

  const priceId = interval === "month" ? plan.monthlyPriceId : plan.yearlyPriceId;
  if (!priceId) {
    return Response.json(
      { error: `No Stripe ${interval}ly price is configured for this plan` },
      { status: 400 }
    );
  }

  const stripe = await getStripe();
  const stripeConfig = await getStripeConfig();
  const origin = requestOrigin(request);
  const successUrl = toAbsoluteUrl(stripeConfig.checkoutSuccessUrl, origin);
  const cancelUrl = toAbsoluteUrl(stripeConfig.checkoutCancelUrl, origin);

  let customerId = user!.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user!.email,
      name: user!.name,
      metadata: { userId: user!.id },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: user!.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: stripeConfig.allowPromotionCodes,
    ...(stripeConfig.trialDays > 0
      ? { subscription_data: { trial_period_days: stripeConfig.trialDays } }
      : {}),
    metadata: { userId: user!.id, planId: plan.id, interval },
  });

  if (!session.url) {
    return Response.json({ error: "Stripe checkout URL was not generated" }, { status: 500 });
  }

  return Response.json({ url: session.url });
}
