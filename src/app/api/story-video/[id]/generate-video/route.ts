import { NextRequest, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, requireAuth } from "@/lib/auth";
import { generateVideoSegment } from "@/services/wavespeed";
import {
  mergeVideoWithAudio,
  mergeAllSegments,
  addTikTokCaptions,
  getDimensions,
} from "@/services/ffmpeg";
import { pipelineTraceLine, summarizeMediaUrl } from "@/lib/pipelineTrace";
import {
  normalizeSegmentUrlsForNeonvideoMerge,
  mirrorFfmpegDownloadUrlIfNeeded,
} from "@/services/segmentMirror";
import { nanoid } from "nanoid";
import type { StoryScene } from "@/types";
import { isNarratorCharacter } from "@/lib/storyTtsVoices";
import { normalizeStoryVideoAspectRatio } from "@/lib/constants";

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

  const sceneImages = project.storySceneImages as unknown as string[];
  const audioUrls = project.storyAudioUrls as unknown as string[];

  if (!sceneImages?.length || !audioUrls?.some((u) => u)) {
    return Response.json(
      { error: "Assets not ready. Scene images and audio required." },
      { status: 400 }
    );
  }

  if (project.generationStatus === "generating_video") {
    return Response.json(
      { error: "Video generation already in progress" },
      { status: 409 }
    );
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

  const projectSnapshot = project;

  // §5.5 — async video pipeline (after() keeps work alive after the HTTP response)
  after(async () => {
    const videoTrace = async (detail: string) => {
      const line = pipelineTraceLine("story-video", detail);
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
        console.error("[story-video] persist debug log failed", logErr);
      }
    };

    try {
      const storyAspect = normalizeStoryVideoAspectRatio(
        projectSnapshot.aspectRatio
      );
      const script = projectSnapshot.storyScript as unknown as StoryScene[];
      const scenePrompts = projectSnapshot.storyScenePrompts as unknown as string[];
      const dimensions = getDimensions(storyAspect);

      await videoTrace(
        `Pipeline begin project=${id} scenes=${sceneImages.length} aspect=${storyAspect} dimensions=${dimensions}`
      );

      await prisma.generationLog.create({
        data: { projectId: id, step: "story_video_start", status: "started" },
      });

      await videoTrace(
        "Phase: parallel per-scene video (WaveSpeed Seedance / InfiniteTalk + optional ffmpeg narrator mux)"
      );

      // §5.5.4 — parallel segment generation
      const segmentResults = await Promise.all(
        sceneImages.map(async (sceneImage, i) => {
          const scene = script[i];
          const sceneAudio = audioUrls[i];
          const scenePrompt = scenePrompts?.[i] || scene?.scene_description || "animated scene";

          await videoTrace(
            `Scene ${i + 1}/${sceneImages.length} START speaker=${scene?.character ?? "?"} model=${isNarratorCharacter(scene?.character) ? "seedance+mux" : "infinitetalk"} image=${summarizeMediaUrl(sceneImage)}`
          );

          await prisma.generationLog.create({
            data: {
              projectId: id,
              step: "story_video_segment",
              status: "started",
              message: `Scene ${i + 1}/${sceneImages.length}`,
            },
          });

          let segmentUrl: string;

          if (isNarratorCharacter(scene?.character)) {
            await videoTrace(
              `Scene ${i + 1}: calling WaveSpeed Seedance (silent)…`
            );
            const silentUrl = await generateVideoSegment(
              "seedance",
              sceneImage,
              scenePrompt,
              undefined,
              storyAspect
            );
            await videoTrace(
              `Scene ${i + 1}: Seedance OK → ${summarizeMediaUrl(silentUrl)}`
            );

            if (sceneAudio) {
              await videoTrace(
                `Scene ${i + 1}: ffmpeg merge_videos (silent + TTS) audio=${summarizeMediaUrl(sceneAudio)}`
              );
              segmentUrl = await mergeVideoWithAudio(
                silentUrl,
                sceneAudio,
                dimensions,
                videoTrace,
                `scene-${i + 1}`
              );
              await videoTrace(
                `Scene ${i + 1}: narrator mux OK → ${summarizeMediaUrl(segmentUrl)}`
              );
            } else {
              console.warn(`[story-video] Scene ${i}: narrator has no audio, keeping silent clip`);
              segmentUrl = silentUrl;
              await videoTrace(`Scene ${i + 1}: no TTS; using silent clip only`);
            }
          } else {
            await videoTrace(
              `Scene ${i + 1}: calling WaveSpeed InfiniteTalk…`
            );
            segmentUrl = await generateVideoSegment(
              "infinitetalk",
              sceneImage,
              scenePrompt,
              sceneAudio || "",
              storyAspect
            );
            await videoTrace(
              `Scene ${i + 1}: InfiniteTalk OK → ${summarizeMediaUrl(segmentUrl)}`
            );
          }

          await prisma.generationLog.create({
            data: {
              projectId: id,
              step: "story_video_segment",
              status: "completed",
              message: `Scene ${i + 1}/${sceneImages.length}`,
            },
          });

          return { index: i, url: segmentUrl };
        })
      );

      // §5.5.4 — sort by index to maintain script order
      segmentResults.sort((a, b) => a.index - b.index);
      const orderedSegmentUrls = segmentResults.map((r) => r.url);

      await prisma.generationLog.create({
        data: { projectId: id, step: "story_video_segments", status: "completed" },
      });

      await videoTrace(
        `Phase: all ${orderedSegmentUrls.length} segment clips ready; starting ffmpeg merge tree`
      );

      // §5.5.5 — final merge (concat all clips)
      await prisma.generationLog.create({
        data: { projectId: id, step: "story_video_merge", status: "started" },
      });

      await videoTrace(
        "Normalizing segment URLs (re-host www.ffmpegapi.net narrator mux outputs so neonvideo_merge can fetch them)"
      );
      const mergeReadyUrls = await normalizeSegmentUrlsForNeonvideoMerge(
        orderedSegmentUrls,
        videoTrace
      );

      let finalUrl = await mergeAllSegments(
        mergeReadyUrls,
        dimensions,
        undefined,
        videoTrace,
        (u) =>
          mirrorFfmpegDownloadUrlIfNeeded(u, videoTrace, "merge-intermediate")
      );

      await videoTrace(`Merge complete (pre-captions): ${summarizeMediaUrl(finalUrl)}`);

      await prisma.generationLog.create({
        data: { projectId: id, step: "story_video_merge", status: "completed" },
      });

      // §5.5.6 — captions (non-fatal)
      try {
        await videoTrace("Phase: TikTok-style captions (ffmpegapi)");
        const captionedUrl = await addTikTokCaptions(
          finalUrl,
          storyAspect,
          "yellow-bg",
          "bottom",
          videoTrace
        );
        finalUrl = captionedUrl;
        await videoTrace(`Captions OK → ${summarizeMediaUrl(finalUrl)}`);
        await prisma.generationLog.create({
          data: { projectId: id, step: "story_video_captions", status: "completed" },
        });
      } catch (captionErr) {
        console.warn("[story-video] Captions failed, using uncaptioned merge:", captionErr);
        await videoTrace(
          `Captions FAILED (using uncaptioned merge): ${captionErr instanceof Error ? captionErr.message : String(captionErr)}`
        );
        await prisma.generationLog.create({
          data: {
            projectId: id,
            step: "story_video_captions",
            status: "warning",
            message: captionErr instanceof Error ? captionErr.message : "Captions failed",
          },
        });
      }

      // §5.5.7 — completion
      await videoTrace("Pipeline SUCCESS");
      await prisma.generationLog.create({
        data: {
          projectId: id,
          step: "story_video_complete",
          status: "completed",
          message: JSON.stringify({ finalVideoUrl: finalUrl }),
        },
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
      const stack = err instanceof Error ? err.stack : "";
      console.error("[story-video] Pipeline error:", err);

      try {
        const failLine = pipelineTraceLine(
          "story-video",
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
        data: { projectId: id, step: "story_video_error", status: "failed", message },
      });
      await prisma.project.update({
        where: { id },
        data: { generationStatus: "failed" },
      });
    }
  });

  return response;
}
