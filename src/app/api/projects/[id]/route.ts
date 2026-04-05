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
  });

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  return Response.json(project);
}
