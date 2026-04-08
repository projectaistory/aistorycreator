import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAuthUser, requireAuth } from "@/lib/auth";

const MIN_LEN = 8;

export async function POST(request: NextRequest) {
  const authed = await getAuthUser(request);
  const authErr = requireAuth(authed);
  if (authErr) return authErr;

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const currentPassword =
    typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword || !newPassword) {
    return Response.json(
      { error: "Current password and new password are required" },
      { status: 400 }
    );
  }

  if (newPassword.length < MIN_LEN) {
    return Response.json(
      { error: `New password must be at least ${MIN_LEN} characters` },
      { status: 400 }
    );
  }

  const fullUser = await prisma.user.findUnique({
    where: { id: authed!.id },
    select: { password: true },
  });

  if (!fullUser) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const valid = await bcrypt.compare(currentPassword, fullUser.password);
  if (!valid) {
    return Response.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: authed!.id },
    data: { password: hashedPassword },
  });

  return Response.json({ ok: true });
}
