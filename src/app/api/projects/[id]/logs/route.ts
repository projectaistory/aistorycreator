import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, requireAuth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  const authErr = requireAuth(user);
  if (authErr) return authErr;

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, userId: user!.id },
    select: { id: true },
  });

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const logs = await prisma.generationLog.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "asc" },
  });

  return Response.json({ logs });
}
