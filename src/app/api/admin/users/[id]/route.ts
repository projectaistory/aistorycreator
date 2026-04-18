import { NextRequest } from "next/server";
import { getAuthUser, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

function isUserRole(v: unknown): v is UserRole {
  return v === "USER" || v === "ADMIN";
}

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

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, email: true },
  });
  if (!target) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const data: {
    name?: string;
    email?: string;
    credits?: number;
    role?: UserRole;
    planId?: string | null;
  } = {};

  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (typeof body.email === "string" && body.email.trim()) {
    data.email = body.email.trim().toLowerCase();
  }
  if (typeof body.credits === "number" && Number.isFinite(body.credits)) {
    data.credits = Math.max(0, Math.floor(body.credits));
  }
  if (body.role !== undefined) {
    if (!isUserRole(body.role)) {
      return Response.json({ error: "Invalid role" }, { status: 400 });
    }
    if (target.role === "ADMIN" && body.role === "USER") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        return Response.json(
          { error: "Cannot remove the last admin" },
          { status: 400 }
        );
      }
    }
    data.role = body.role;
  }
  if (body.planId === null) {
    data.planId = null;
  } else if (typeof body.planId === "string" && body.planId) {
    const plan = await prisma.plan.findUnique({ where: { id: body.planId } });
    if (!plan) {
      return Response.json({ error: "Plan not found" }, { status: 400 });
    }
    data.planId = body.planId;
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  if (data.email && data.email !== target.email) {
    const taken = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (taken) {
      return Response.json({ error: "Email already in use" }, { status: 409 });
    }
  }

  try {
    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        credits: true,
        role: true,
        planId: true,
        createdAt: true,
        plan: { select: { id: true, name: true, slug: true } },
      },
    });

    return Response.json({
      user: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (e) {
    console.error("[admin/users/patch]", e);
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
  if (!admin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  if (admin.id === id) {
    return Response.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
  if (!target) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  if (target.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return Response.json(
        { error: "Cannot delete the last admin account" },
        { status: 400 }
      );
    }
  }

  try {
    await prisma.user.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[admin/users/delete]", e);
    return Response.json({ error: "Delete failed" }, { status: 500 });
  }
}
