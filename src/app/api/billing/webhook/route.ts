import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getSetting, getStripeConfig } from "@/lib/site-settings";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

async function findPlanByPriceId(priceId: string | null | undefined) {
  if (!priceId) return null;
  return prisma.plan.findFirst({
    where: {
      OR: [{ monthlyPriceId: priceId }, { yearlyPriceId: priceId }],
    },
    select: { id: true, includedCredits: true },
  });
}

function subscriptionPriceId(subscription: Stripe.Subscription) {
  return subscription.items.data[0]?.price?.id ?? null;
}

/** Stripe v22+ types expose billing period on subscription items, not on Subscription. */
function subscriptionCurrentPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const endUnix = subscription.items.data[0]?.current_period_end;
  if (endUnix == null) return null;
  return new Date(endUnix * 1000);
}

export async function POST(request: Request) {
  const stripeConfig = await getStripeConfig();
  if (!stripeConfig.webhookSecret) {
    return Response.json({ error: "Missing Stripe webhook secret" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const payload = await request.text();
  const stripe = await getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, stripeConfig.webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid webhook signature";
    return Response.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = typeof session.customer === "string" ? session.customer : null;
        if (!customerId) break;

        let subscription: Stripe.Subscription | null = null;
        if (typeof session.subscription === "string") {
          subscription = await stripe.subscriptions.retrieve(session.subscription);
        }
        const priceId = subscription ? subscriptionPriceId(subscription) : null;
        const matchedPlan = await findPlanByPriceId(priceId);

        const user =
          (session.metadata?.userId
            ? await prisma.user.findUnique({ where: { id: session.metadata.userId } })
            : null) ??
          (await prisma.user.findFirst({ where: { stripeCustomerId: customerId } }));
        if (!user) break;

        await prisma.user.update({
          where: { id: user.id },
          data: {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription?.id ?? null,
            stripeSubscriptionStatus: subscription?.status ?? "active",
            stripePriceId: priceId,
            stripeCurrentPeriodEnd: subscription ? subscriptionCurrentPeriodEnd(subscription) : null,
            planId: matchedPlan?.id ?? user.planId,
            ...(matchedPlan && user.stripeSubscriptionId !== subscription?.id
              ? { credits: { increment: matchedPlan.includedCredits } }
              : {}),
          },
        });
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : null;
        if (!customerId) break;
        const priceId = subscriptionPriceId(sub);
        const matchedPlan = await findPlanByPriceId(priceId);
        const freeSlug = await getSetting<string>("billing.default_plan_slug", "free");
        const freePlan = await prisma.plan.findUnique({ where: { slug: freeSlug } });
        const shouldFallback = sub.status === "canceled" || event.type === "customer.subscription.deleted";

        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            stripeSubscriptionId: sub.id,
            stripeSubscriptionStatus: sub.status,
            stripePriceId: priceId,
            stripeCurrentPeriodEnd: subscriptionCurrentPeriodEnd(sub),
            planId: shouldFallback ? (freePlan?.id ?? null) : (matchedPlan?.id ?? undefined),
          },
        });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.billing_reason !== "subscription_cycle") break;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
        if (!customerId) break;

        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
          select: { id: true, stripePriceId: true },
        });
        if (!user?.stripePriceId) break;

        const matchedPlan = await findPlanByPriceId(user.stripePriceId);
        if (!matchedPlan) break;
        await prisma.user.update({
          where: { id: user.id },
          data: { credits: { increment: matchedPlan.includedCredits } },
        });
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("[billing/webhook]", err);
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return Response.json({ received: true });
}
