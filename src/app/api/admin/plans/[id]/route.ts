import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getAuthUser, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializePlan } from "@/lib/admin-serialize";

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await getAuthUser(request);
  const err = requireAdmin(admin);
  if (err) return err;

  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await prisma.plan.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Plan not found" }, { status: 404 });
  }

  const data: {
    name?: string;
    slug?: string;
    features?: Prisma.InputJsonValue;
    monthlyPrice?: number;
    yearlyPrice?: number;
    includedCredits?: number;
  } = {};

  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (typeof body.slug === "string" && body.slug.trim()) {
    data.slug = body.slug.trim().toLowerCase();
  }
  if (body.features !== undefined) {
    if (!Array.isArray(body.features)) {
      return Response.json({ error: "features must be an array" }, { status: 400 });
    }
    data.features = body.features as Prisma.InputJsonValue;
  }
  if (typeof body.monthlyPrice === "number" && Number.isFinite(body.monthlyPrice)) {
    if (body.monthlyPrice < 0) {
      return Response.json({ error: "monthlyPrice must be >= 0" }, { status: 400 });
    }
    data.monthlyPrice = body.monthlyPrice;
  }
  if (typeof body.yearlyPrice === "number" && Number.isFinite(body.yearlyPrice)) {
    if (body.yearlyPrice < 0) {
      return Response.json({ error: "yearlyPrice must be >= 0" }, { status: 400 });
    }
    data.yearlyPrice = body.yearlyPrice;
  }
  if (body.includedCredits !== undefined) {
    if (
      typeof body.includedCredits !== "number" ||
      !Number.isFinite(body.includedCredits) ||
      !Number.isInteger(body.includedCredits) ||
      body.includedCredits < 0
    ) {
      return Response.json(
        { error: "includedCredits must be a non-negative integer" },
        { status: 400 }
      );
    }
    data.includedCredits = body.includedCredits;
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    const plan = await prisma.plan.update({ where: { id }, data });
    return Response.json({ plan: serializePlan(plan) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return Response.json({ error: "Plan name or slug already exists" }, { status: 409 });
    }
    console.error("[admin/plans PATCH]", e);
    return Response.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await getAuthUser(request);
  const err = requireAdmin(admin);
  if (err) return err;

  const { id } = await ctx.params;
  const existing = await prisma.plan.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Plan not found" }, { status: 404 });
  }

  const usersOnPlan = await prisma.user.count({ where: { planId: id } });
  if (usersOnPlan > 0) {
    return Response.json(
      {
        error: `Cannot delete plan: ${usersOnPlan} user(s) are assigned. Reassign them first.`,
      },
      { status: 400 }
    );
  }

  await prisma.plan.delete({ where: { id } });
  return Response.json({ ok: true });
}
