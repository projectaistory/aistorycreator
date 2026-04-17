import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getAuthUser, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializePlan } from "@/lib/admin-serialize";

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  const err = requireAdmin(user);
  if (err) return err;

  const plans = await prisma.plan.findMany({ orderBy: { monthlyPrice: "asc" } });
  return Response.json({ plans: plans.map(serializePlan) });
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  const err = requireAdmin(user);
  if (err) return err;

  let body: {
    name?: string;
    slug?: string;
    features?: unknown;
    monthlyPrice?: unknown;
    yearlyPrice?: unknown;
    includedCredits?: unknown;
    monthlyPriceId?: unknown;
    yearlyPriceId?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (!name || !slug) {
    return Response.json({ error: "name and slug are required" }, { status: 400 });
  }

  const monthly =
    typeof body.monthlyPrice === "number" && Number.isFinite(body.monthlyPrice)
      ? body.monthlyPrice
      : NaN;
  const yearly =
    typeof body.yearlyPrice === "number" && Number.isFinite(body.yearlyPrice)
      ? body.yearlyPrice
      : NaN;
  if (monthly < 0 || yearly < 0 || Number.isNaN(monthly) || Number.isNaN(yearly)) {
    return Response.json(
      { error: "monthlyPrice and yearlyPrice must be non-negative numbers" },
      { status: 400 }
    );
  }

  let includedCredits = 0;
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
    includedCredits = body.includedCredits;
  }

  let features: Prisma.InputJsonValue = [];
  if (Array.isArray(body.features)) {
    features = body.features as Prisma.InputJsonValue;
  } else if (body.features !== undefined) {
    return Response.json({ error: "features must be an array" }, { status: 400 });
  }

  const monthlyPriceId =
    typeof body.monthlyPriceId === "string" ? body.monthlyPriceId.trim() : "";
  const yearlyPriceId =
    typeof body.yearlyPriceId === "string" ? body.yearlyPriceId.trim() : "";
  if (body.monthlyPriceId !== undefined && typeof body.monthlyPriceId !== "string") {
    return Response.json({ error: "monthlyPriceId must be a string" }, { status: 400 });
  }
  if (body.yearlyPriceId !== undefined && typeof body.yearlyPriceId !== "string") {
    return Response.json({ error: "yearlyPriceId must be a string" }, { status: 400 });
  }

  try {
    const plan = await prisma.plan.create({
      data: {
        name,
        slug,
        features,
        monthlyPrice: monthly,
        yearlyPrice: yearly,
        monthlyPriceId: monthlyPriceId || null,
        yearlyPriceId: yearlyPriceId || null,
        includedCredits,
      },
    });
    return Response.json({ plan: serializePlan(plan) }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return Response.json({ error: "Plan name or slug already exists" }, { status: 409 });
    }
    console.error("[admin/plans POST]", e);
    return Response.json({ error: "Create failed" }, { status: 500 });
  }
}
