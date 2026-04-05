import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, requireAuth } from "@/lib/auth";
import { generateSingleSceneImage } from "@/services/wavespeed";
import type { StoryCharacter } from "@/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sceneIndex: string }> }
) {
  const user = await getAuthUser(request);
  const authErr = requireAuth(user);
  if (authErr) return authErr;

  const { id, sceneIndex: rawIndex } = await params;
  const sceneIndex = parseInt(rawIndex, 10);

  const project = await prisma.project.findFirst({
    where: { id, userId: user!.id },
  });

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const scenePrompts = project.storyScenePrompts as unknown as string[];
  if (sceneIndex < 0 || sceneIndex >= scenePrompts.length) {
    return Response.json({ error: "Invalid scene index" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const prompt = (body as Record<string, string>).prompt || scenePrompts[sceneIndex];

  const characters = project.storyCharacters as unknown as StoryCharacter[];
  const refCharacter = characters.find((c) => c.imageUrl);

  try {
    const newImage = await generateSingleSceneImage(
      prompt,
      refCharacter?.imageUrl || null,
      project.aspectRatio
    );

    const sceneImages = project.storySceneImages as unknown as string[];
    sceneImages[sceneIndex] = newImage;
    scenePrompts[sceneIndex] = prompt;

    await prisma.project.update({
      where: { id },
      data: { storySceneImages: sceneImages, storyScenePrompts: scenePrompts },
    });

    return Response.json({ imageUrl: newImage });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scene regeneration failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
