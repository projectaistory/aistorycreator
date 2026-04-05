import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, requireAuth } from "@/lib/auth";
import type { StoryScene } from "@/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  const authErr = requireAuth(user);
  if (authErr) return authErr;

  const { id } = await params;
  const { script } = await request.json();

  if (!Array.isArray(script)) {
    return Response.json({ error: "script must be an array" }, { status: 400 });
  }

  const project = await prisma.project.findFirst({
    where: { id, userId: user!.id },
  });

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  await prisma.project.update({
    where: { id },
    data: {
      storyScript: script,
      storyScenePrompts: script.map((s: StoryScene) => s.scene_description),
    },
  });

  return Response.json({ success: true });
}
