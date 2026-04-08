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

  if (planId !== null) {
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      return Response.json({ error: "Plan not found" }, { status: 404 });
    }
  }

  const user = await prisma.user.update({
    where: { id: authed!.id },
    data: { planId },
    select: userSelect,
  });

  return Response.json({ user });
}
