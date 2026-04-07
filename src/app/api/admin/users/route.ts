import { NextRequest } from "next/server";
import { getAuthUser, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  const err = requireAdmin(user);
  if (err) return err;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      credits: true,
      role: true,
      planId: true,
      createdAt: true,
      plan: { select: { id: true, name: true, slug: true } },
      _count: { select: { projects: true, characters: true } },
    },
  });

  return Response.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      credits: u.credits,
      role: u.role,
      planId: u.planId,
      createdAt: u.createdAt.toISOString(),
      plan: u.plan,
      projectCount: u._count.projects,
      characterCount: u._count.characters,
    })),
  });
}
