import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, requireAuth } from "@/lib/auth";
import { getStoryVideoGenerationCredits, STORY_DEFAULT_NARRATOR_VOICE } from "@/lib/constants";
import { generateStoryAudio, generateSceneImages, generateSceneImagesFromText } from "@/services/wavespeed";
import type { StoryCharacter, StoryScene } from "@/types";

export async function POST(
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

  if (project.generationStatus === "generating") {
    return Response.json({ error: "Assets already generating" }, { status: 409 });
  }

  const creditsRequired = getStoryVideoGenerationCredits(project.storyDuration);
  const dbUser = await prisma.user.findUnique({ where: { id: user!.id } });

  if (!dbUser || dbUser.credits < creditsRequired) {
    return Response.json(
      {
        error: "Insufficient credits",
        creditsRequired,
        creditsRemaining: dbUser?.credits || 0,
        storyDuration: project.storyDuration,
      },
      { status: 402 }
    );
  }

  await prisma.user.update({
    where: { id: user!.id },
    data: { credits: { decrement: creditsRequired } },
  });

  await prisma.project.update({
    where: { id },
    data: { generationStatus: "generating", generationStartedAt: new Date() },
  });

  // Return immediately, pipeline continues async
  const response = Response.json({
    status: "generating",
    projectId: id,
    creditsCharged: creditsRequired,
    storyDuration: project.storyDuration,
  });

  // Async pipeline
  (async () => {
    try {
      const script = project.storyScript as unknown as StoryScene[];
      const characters = project.storyCharacters as unknown as StoryCharacter[];
      const voiceMap: Record<string, string> = {};
      characters.forEach((c) => {
        if (c.voiceId) voiceMap[c.name] = c.voiceId;
      });

      // Audio generation
      await prisma.generationLog.create({
        data: { projectId: id, step: "story_audio", status: "started" },
      });

      const audioUrls: string[] = [];
      for (const scene of script) {
        let voiceId: string;
        if (scene.character === "Narrator") {
          voiceId = project.storyNarratorVoice || STORY_DEFAULT_NARRATOR_VOICE;
        } else {
          voiceId = voiceMap[scene.character] || STORY_DEFAULT_NARRATOR_VOICE;
        }

        const audioUrl = await generateStoryAudio(scene.audio, voiceId);
        audioUrls.push(audioUrl);
      }

      await prisma.generationLog.create({
        data: { projectId: id, step: "story_audio", status: "completed" },
      });

      // Image generation
      await prisma.generationLog.create({
        data: { projectId: id, step: "story_images", status: "started" },
      });

      const descriptions = script.map((s) => s.scene_description);
      const refCharacter = characters.find((c) => c.imageUrl);
      let sceneImages: string[];

      if (refCharacter) {
        sceneImages = await generateSceneImages(
          descriptions,
          refCharacter.imageUrl,
          project.aspectRatio
        );
      } else {
        sceneImages = await generateSceneImagesFromText(
          descriptions,
          project.aspectRatio
        );
      }

      await prisma.generationLog.create({
        data: { projectId: id, step: "story_images", status: "completed" },
      });

      await prisma.project.update({
        where: { id },
        data: {
          storyAudioUrls: audioUrls,
          storySceneImages: sceneImages,
          generationStatus: "completed",
          currentStep: 3,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Asset generation failed";
      await prisma.generationLog.create({
        data: { projectId: id, step: "story_assets_error", status: "failed", message },
      });
      await prisma.project.update({
        where: { id },
        data: { generationStatus: "failed" },
      });
    }
  })();

  return response;
}
