import { NextRequest } from "next/server";
import { getAuthUser, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  const err = requireAdmin(user);
  if (err) return err;

  const [userCount, adminCount, planCount, projectCount, characterCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.plan.count(),
      prisma.project.count(),
      prisma.character.count(),
    ]);

  const recentUsers = await prisma.user.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      credits: true,
      createdAt: true,
      plan: { select: { name: true, slug: true } },
    },
  });

  return Response.json({
    stats: {
      users: userCount,
      admins: adminCount,
      plans: planCount,
      projects: projectCount,
      characters: characterCount,
    },
    recentUsers: recentUsers.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
    })),
  });
}
