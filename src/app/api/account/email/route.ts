import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser, requireAuth, signToken } from "@/lib/auth";

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

  let body: { email?: string; currentPassword?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const currentPassword =
    typeof body.currentPassword === "string" ? body.currentPassword : "";

  if (!email || !currentPassword) {
    return Response.json(
      { error: "Email and current password are required" },
      { status: 400 }
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Invalid email address" }, { status: 400 });
  }

  const fullUser = await prisma.user.findUnique({
    where: { id: authed!.id },
    select: { password: true, email: true },
  });

  if (!fullUser) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  if (fullUser.email.toLowerCase() === email) {
    return Response.json({ error: "This is already your email" }, { status: 400 });
  }

  const valid = await bcrypt.compare(currentPassword, fullUser.password);
  if (!valid) {
    return Response.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  try {
    const user = await prisma.user.update({
      where: { id: authed!.id },
      data: { email },
      select: userSelect,
    });

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return Response.json({ user, token });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return Response.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }
    return Response.json({ error: "Could not update email" }, { status: 500 });
  }
}
