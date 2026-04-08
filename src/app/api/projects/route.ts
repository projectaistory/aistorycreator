import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  const authErr = requireAuth(user);
  if (authErr) return authErr;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "story_video";

  const projects = await prisma.project.findMany({
    where: { userId: user!.id, projectType: type },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      storyPrompt: true,
      storyDuration: true,
      generationStatus: true,
      finalVideoUrl: true,
      isCompleted: true,
      currentStep: true,
      createdAt: true,
      aspectRatio: true,
      storySceneImages: true,
    },
  });

  return Response.json({
    projects: projects.map((p) => {
      const sceneImages = p.storySceneImages as unknown;
      const previewImageUrl =
        Array.isArray(sceneImages) && typeof sceneImages[0] === "string"
          ? sceneImages[0]
          : null;
      return {
        id: p.id,
        storyPrompt: p.storyPrompt,
        storyDuration: p.storyDuration,
        generationStatus: p.generationStatus,
        finalVideoUrl: p.finalVideoUrl,
        isCompleted: p.isCompleted,
        currentStep: p.currentStep,
        createdAt: p.createdAt.toISOString(),
        aspectRatio: p.aspectRatio,
        previewImageUrl,
      };
    }),
  });
}
