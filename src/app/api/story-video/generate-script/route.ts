import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, requireAuth } from "@/lib/auth";
import { generateStoryScript } from "@/services/openai";
import type { Prisma } from "@prisma/client";
import {
  STORY_DEFAULT_VIDEO_MODEL,
  STORY_DURATION_MIN,
  STORY_MAX_CHARACTERS,
  normalizeStoryVideoAspectRatio,
  normalizeStoryVideoModel,
} from "@/lib/constants";
import { maxStoryDurationSecondsForPlan } from "@/lib/planLimits";

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  const authErr = requireAuth(user);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const {
      storyPrompt,
      duration: rawDuration,
      narrator = true,
      narratorVoice,
      characters = [],
      aspectRatio: rawAspect,
      videoModel: rawVideoModel,
    } = body;

    if (!storyPrompt) {
      return Response.json({ error: "storyPrompt is required" }, { status: 400 });
    }

    const durationCap = maxStoryDurationSecondsForPlan(user!.plan?.slug);
    const duration = Math.max(
      STORY_DURATION_MIN,
      Math.min(durationCap, Number(rawDuration) || 60)
    );

    const aspectRatio = normalizeStoryVideoAspectRatio(rawAspect);
    const videoModel = normalizeStoryVideoModel(rawVideoModel);
    if (characters.length > STORY_MAX_CHARACTERS) {
      return Response.json(
        {
          error: `A maximum of ${STORY_MAX_CHARACTERS} characters can be selected`,
        },
        { status: 400 }
      );
    }
    const trimmedChars = characters.slice(0, STORY_MAX_CHARACTERS);

    const script = await generateStoryScript(
      storyPrompt,
      duration,
      trimmedChars,
      narrator
    );

    const project = await prisma.project.create({
      data: {
        userId: user!.id,
        projectType: "story_video",
        storyPrompt,
        storyDuration: duration,
        storyNarrator: narrator,
        storyNarratorVoice: narratorVoice || null,
        storyCharacters: trimmedChars as unknown as Prisma.InputJsonValue,
        storyScript: script as unknown as Prisma.InputJsonValue,
        storyScenePrompts: script.map((s) => s.scene_description) as unknown as Prisma.InputJsonValue,
        aspectRatio,
        videoQuality: videoModel || STORY_DEFAULT_VIDEO_MODEL,
        currentStep: 2,
      },
    });

    await prisma.generationLog.create({
      data: {
        projectId: project.id,
        step: "story_script",
        status: "completed",
        message: `Generated ${script.length} scenes`,
      },
    });

    return Response.json({ projectId: project.id, script });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Script generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
