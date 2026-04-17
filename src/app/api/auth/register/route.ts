import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return Response.json(
        { error: "Email, password, and name are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return Response.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const freePlan = await prisma.plan.findUnique({
      where: { slug: "free" },
      select: { id: true, includedCredits: true },
    });

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: "USER",
        ...(freePlan
          ? { planId: freePlan.id, credits: freePlan.includedCredits }
          : {}),
      },
      select: {
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
      },
    });

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return Response.json({ token, user });
  } catch (err) {
    console.error("[api/auth/register]", err);
    const isDev = process.env.NODE_ENV === "development";
    const prismaCode =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: string }).code)
        : "";
    const message =
      isDev && err instanceof Error
        ? `${err.message}${prismaCode ? ` (${prismaCode})` : ""}`
        : "Registration failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
