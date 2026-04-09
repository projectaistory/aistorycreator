import { NextRequest, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, requireAuth } from "@/lib/auth";
import {
  getStoryVideoGenerationCredits,
  normalizeStoryVideoAspectRatio,
} from "@/lib/constants";
import {
  FREE_PLAN_MAX_STORY_DURATION_SECONDS,
  isFreePlanSlug,
} from "@/lib/planLimits";
import {
  generateStoryAudio,
  generateSceneImages,
  generateSceneImagesFromText,
} from "@/services/wavespeed";
import type { StoryCharacter, StoryScene } from "@/types";
import { pipelineTraceLine, summarizeMediaUrl } from "@/lib/pipelineTrace";
import {
  buildVoiceByCharacterId,
  buildVoiceMap,
  resolveCanonicalSpeaker,
  resolveVoiceIdForScene,
} from "@/lib/storyTtsVoices";

const DEBUG_MSG_MAX = 4000;

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
  const dbUser = await prisma.user.findUnique({
    where: { id: user!.id },
    select: {
      credits: true,
      plan: { select: { slug: true } },
    },
  });

  if (
    dbUser &&
    isFreePlanSlug(dbUser.plan?.slug) &&
    project.storyDuration > FREE_PLAN_MAX_STORY_DURATION_SECONDS
  ) {
    return Response.json(
      {
        error: `Free plan videos are limited to ${FREE_PLAN_MAX_STORY_DURATION_SECONDS} seconds. Create a new story with a shorter duration or upgrade your plan.`,
        freePlanMaxDurationSeconds: FREE_PLAN_MAX_STORY_DURATION_SECONDS,
      },
      { status: 403 }
    );
  }

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

  const response = Response.json({
    status: "generating",
    projectId: id,
    creditsCharged: creditsRequired,
    storyDuration: project.storyDuration,
  });

  const userId = user!.id;
  const projectSnapshot = project;

  after(async () => {
    const assetsTrace = async (detail: string) => {
      const line = pipelineTraceLine("generate-assets", detail);
      console.log(line);
      try {
        await prisma.generationLog.create({
          data: {
            projectId: id,
            step: "story_pipeline_debug",
            status: "info",
            message: line.slice(0, DEBUG_MSG_MAX),
          },
        });
      } catch (logErr) {
        console.error("[generate-assets] persist debug log failed", logErr);
      }
    };

    try {
      const storyAspect = normalizeStoryVideoAspectRatio(
        projectSnapshot.aspectRatio
      );
      const script = projectSnapshot.storyScript as unknown as StoryScene[];
      const characters =
        projectSnapshot.storyCharacters as unknown as StoryCharacter[];
      const voiceMap = buildVoiceMap(characters);
      const voiceByCharacterId = buildVoiceByCharacterId(characters);
      const names = characters.map((c) => c.name.trim());
      const narratorOn = projectSnapshot.storyNarrator;

      const charImageCount = characters.filter((c) => c.imageUrl).length;
      await assetsTrace(
        `Pipeline begin project=${id} scenes=${script.length} aspect=${storyAspect} ref_images=${charImageCount}`
      );

      await prisma.generationLog.create({
        data: { projectId: id, step: "story_audio", status: "started" },
      });

      const audioUrls: string[] = [];
      for (let i = 0; i < script.length; i++) {
        const scene = script[i];
        const canonCharacter = resolveCanonicalSpeaker(
          scene.character,
          names,
          narratorOn
        );
        const sceneForTts: StoryScene = {
          ...scene,
          character: canonCharacter,
        };
        const voiceId = resolveVoiceIdForScene(
          sceneForTts,
          voiceMap,
          voiceByCharacterId,
          projectSnapshot.storyNarratorVoice
        );

        await assetsTrace(
          `TTS scene ${i + 1}/${script.length} speaker="${canonCharacter}" voice="${voiceId}" chars=${scene.audio?.length ?? 0}`
        );

        try {
          const audioUrl = await generateStoryAudio(scene.audio, voiceId);
          audioUrls.push(audioUrl);
          await assetsTrace(
            `TTS scene ${i + 1} OK → ${summarizeMediaUrl(audioUrl)}`
          );
        } catch (sceneErr) {
          const detail =
            sceneErr instanceof Error ? sceneErr.message : String(sceneErr);
          throw new Error(
            `TTS failed at scene ${i + 1}/${script.length} (speaker "${canonCharacter}", voice "${voiceId}"): ${detail}`
          );
        }

        if (i < script.length - 1) {
          await new Promise((r) => setTimeout(r, 250));
        }
      }

      await prisma.generationLog.create({
        data: { projectId: id, step: "story_audio", status: "completed" },
      });

      await assetsTrace("Phase: scene images (Seedream sequential / edit-sequential)");

      await prisma.generationLog.create({
        data: { projectId: id, step: "story_images", status: "started" },
      });

      const descriptions = script.map((s) => s.scene_description);
      const refImageUrls = characters
        .filter((c) => c.imageUrl)
        .map((c) => c.imageUrl);
      let sceneImages: string[];

      if (refImageUrls.length > 0) {
        await assetsTrace(
          `Images WITH ${refImageUrls.length} ref character image(s)=${refImageUrls.map(summarizeMediaUrl).join(", ")} batch_descriptions=${descriptions.length}`
        );
        sceneImages = await generateSceneImages(
          descriptions,
          refImageUrls,
          storyAspect
        );
      } else {
        await assetsTrace(
          `Images TEXT-ONLY sequential descriptions=${descriptions.length}`
        );
        sceneImages = await generateSceneImagesFromText(
          descriptions,
          storyAspect
        );
      }

      await assetsTrace(
        `Images OK count=${sceneImages.length} first=${sceneImages[0] ? summarizeMediaUrl(sceneImages[0]) : "none"}`
      );

      await prisma.generationLog.create({
        data: { projectId: id, step: "story_images", status: "completed" },
      });

      await assetsTrace("Pipeline SUCCESS — assets saved on project");

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
      const message =
        err instanceof Error ? err.message : "Asset generation failed";
      const stack = err instanceof Error ? err.stack : "";
      console.error("[generate-assets] pipeline error:", err);

      try {
        const failLine = pipelineTraceLine(
          "generate-assets",
          `FAIL: ${message}${stack ? `\n${stack.slice(0, 1500)}` : ""}`
        );
        console.log(failLine);
        await prisma.generationLog.create({
          data: {
            projectId: id,
            step: "story_pipeline_debug",
            status: "info",
            message: failLine.slice(0, DEBUG_MSG_MAX),
          },
        });
      } catch {
        /* ignore */
      }

      await prisma.generationLog.create({
        data: {
          projectId: id,
          step: "story_assets_error",
          status: "failed",
          message,
        },
      });
      await prisma.project.update({
        where: { id },
        data: { generationStatus: "failed" },
      });

      await prisma.user.update({
        where: { id: userId },
        data: { credits: { increment: creditsRequired } },
      });
    }
  });

  return response;
}
