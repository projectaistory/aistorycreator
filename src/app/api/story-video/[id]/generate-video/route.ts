import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, requireAuth } from "@/lib/auth";
import { generateVideoSegment } from "@/services/wavespeed";
import { nanoid } from "nanoid";
import type { StoryScene } from "@/types";

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

  const sceneImages = project.storySceneImages as unknown as string[];
  const audioUrls = project.storyAudioUrls as unknown as string[];

  if (!sceneImages?.length || !audioUrls?.some((u) => u)) {
    return Response.json(
      { error: "Assets not ready. Scene images and audio required." },
      { status: 400 }
    );
  }

  if (project.generationStatus === "generating_video") {
    return Response.json({ error: "Video generation already in progress" }, { status: 409 });
  }

  const generationId = nanoid();

  await prisma.project.update({
    where: { id },
    data: { generationStatus: "generating_video" },
  });

  const response = Response.json({
    status: "generating",
    generationId,
    projectId: id,
  });

  // Async video pipeline
  (async () => {
    try {
      const script = project.storyScript as unknown as StoryScene[];

      await prisma.generationLog.create({
        data: { projectId: id, step: "story_video_start", status: "started" },
      });

      const segmentUrls: string[] = [];

      for (let i = 0; i < script.length; i++) {
        const scene = script[i];
        const sceneImage = sceneImages[i];
        const sceneAudio = audioUrls[i];

        await prisma.generationLog.create({
          data: {
            projectId: id,
            step: "story_video_segment",
            status: "started",
            message: `Scene ${i + 1}/${script.length}`,
          },
        });

        let segmentUrl: string;

        if (scene.character === "Narrator") {
          // Seedance (silent motion) for narrator scenes
          segmentUrl = await generateVideoSegment(
            "seedance",
            sceneImage,
            scene.scene_description,
            undefined,
            project.aspectRatio
          );
        } else {
          // InfiniteTalk (lipsync) for character scenes
          segmentUrl = await generateVideoSegment(
            "infinitetalk",
            sceneImage,
            scene.scene_description,
            sceneAudio,
            project.aspectRatio
          );
        }

        segmentUrls.push(segmentUrl);

        await prisma.generationLog.create({
          data: {
            projectId: id,
            step: "story_video_segment",
            status: "completed",
            message: `Scene ${i + 1}/${script.length}`,
          },
        });
      }

      await prisma.generationLog.create({
        data: { projectId: id, step: "story_video_segments", status: "completed" },
      });

      // In a full implementation, segments would be merged via ffmpeg.
      // For now, store the first segment as the final video.
      const finalUrl = segmentUrls[0] || "";

      await prisma.generationLog.create({
        data: { projectId: id, step: "story_video_complete", status: "completed" },
      });

      await prisma.project.update({
        where: { id },
        data: {
          finalVideoUrl: finalUrl,
          isCompleted: true,
          generationStatus: "completed",
          currentStep: 5,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Video generation failed";
      await prisma.generationLog.create({
        data: { projectId: id, step: "story_video_error", status: "failed", message },
      });
      await prisma.project.update({
        where: { id },
        data: { generationStatus: "failed" },
      });
    }
  })();

  return response;
}
