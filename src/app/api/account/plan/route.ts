import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, requireAuth } from "@/lib/auth";

const userSelect = {
  id: true,
  email: true,
  name: true,
  credits: true,
  role: true,
  planId: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  stripeSubscriptionStatus: true,
  stripePriceId: true,
  stripeCurrentPeriodEnd: true,
  createdAt: true,
  plan: { select: { id: true, name: true, slug: true } },
} as const;

export async function PATCH(request: NextRequest) {
  const authed = await getAuthUser(request);
  const authErr = requireAuth(authed);
  if (authErr) return authErr;

  let body: { planId?: string | null };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const planId =
    body.planId === null || body.planId === undefined || body.planId === ""
      ? null
      : typeof body.planId === "string"
        ? body.planId
        : undefined;

  if (planId === undefined) {
    return Response.json({ error: "planId is required (or null to clear)" }, { status: 400 });
  }

  const current = await prisma.user.findUnique({
    where: { id: authed!.id },
    select: {
      planId: true,
      plan: { select: { id: true, name: true, slug: true, monthlyPrice: true } },
    },
  });
  if (!current) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  if (planId === current.planId) {
    const user = await prisma.user.findUnique({
      where: { id: authed!.id },
      select: userSelect,
    });
    return Response.json({ user });
  }

  if (planId === null) {
    return Response.json(
      { error: "Plan changes are limited to downgrades only." },
      { status: 403 }
    );
  }

  const targetPlan = await prisma.plan.findUnique({
    where: { id: planId },
    select: { id: true, monthlyPrice: true },
  });
  if (!targetPlan) {
    return Response.json({ error: "Plan not found" }, { status: 404 });
  }

  if (!current.plan) {
    return Response.json(
      { error: "No current plan is set for this account." },
      { status: 400 }
    );
  }

  const currentMonthly = Number(current.plan.monthlyPrice);
  const targetMonthly = Number(targetPlan.monthlyPrice);
  if (targetMonthly >= currentMonthly) {
    return Response.json(
      { error: "Only downgrades are available right now." },
      { status: 403 }
    );
  }

  const user = await prisma.user.update({
    where: { id: authed!.id },
    data: { planId: targetPlan.id },
    select: userSelect,
  });

  return Response.json({ user });
}
