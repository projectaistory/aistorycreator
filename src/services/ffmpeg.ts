/**
 * ffmpegapi integration — standalone-ai-story-generator-porting-guide.md §6.6
 *
 * Merge modes:
 *  1. Per-scene narrator mux: merge_videos (one silent video + TTS audio)
 *  2. Pairwise concat: neonvideo_merge_videos (2+ video_urls)
 *  3. After binary reduction: single timeline URL is returned as-is (mirrored if mirror fn set);
 *     if ≥2 URLs remain, neonvideo_merge_videos (optional watermark).
 *
 * Long stories: binary pairwise concat, then final step above (see mergeAllSegments).
 *
 * Plus TikTok-style captions: add-tiktok-captions
 */

import { summarizeMediaUrl } from "@/lib/pipelineTrace";

const FFMPEG_POST_RETRIES = 3;
const FFMPEG_RETRY_DELAY_MS = 4000;

/** Optional async line logger (DB + console from caller). */
export type FfmpegTraceFn = (line: string) => void | Promise<void>;

/** Re-host www.ffmpegapi.net outputs before the next neonvideo_merge (required for round 2+). */
export type NeonvideoMergeMirrorFn = (url: string) => Promise<string>;

function getFfmpegApiBase(): string {
  const base = process.env.FFMPEG_API_BASE?.trim().replace(/\/$/, "");
  if (!base) {
    throw new Error(
      "FFMPEG_API_BASE is missing or empty. Set it in the environment so ffmpeg endpoints resolve from this base URL."
    );
  }
  return base;
}

function getFfmpegEndpoint(
  path: "/api/merge_videos" | "/api/neonvideo_merge_videos" | "/api/videos/add-tiktok-captions"
): string {
  return `${getFfmpegApiBase()}${path}`;
}

function getApiKey() {
  const key = process.env.FFMPEG_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "FFMPEG_API_KEY is missing or empty. In Next.js, .env.local overrides .env — remove FFMPEG_API_KEY from .env.local if it is blank, or set the real key there."
    );
  }
  return key;
}

function parseDownloadUrl(data: Record<string, unknown>): string {
  const url =
    (data as Record<string, string>).download_url ||
    (data as Record<string, string>).url ||
    (data as Record<string, string>).output_url;
  return url || "";
}

function summarizeFfmpegBody(body: Record<string, unknown>): string {
  const parts: string[] = [];
  const v = body.video_urls;
  if (Array.isArray(v)) {
    parts.push(`videos=${v.length}`);
    v.forEach((u, idx) => {
      if (typeof u === "string") {
        parts.push(`  [${idx}] ${summarizeMediaUrl(u)}`);
      }
    });
  }
  if (typeof body.video_url === "string") {
    parts.push(`video_url=${summarizeMediaUrl(body.video_url)}`);
  }
  if (body.audio_url && String(body.audio_url).length > 0) {
    parts.push(`audio=${summarizeMediaUrl(String(body.audio_url))}`);
  }
  if (body.outro_url) parts.push("outro=yes");
  if (body.watermark_url) parts.push("watermark=yes");
  parts.push(`dimensions=${String(body.dimensions ?? "")}`);
  return parts.join(" | ");
}

function isRetriableFfmpegError(status: number, bodyText: string): boolean {
  if (status >= 500) return true;
  if (status !== 400) return false;
  const lower = bodyText.toLowerCase();
  return (
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("download") ||
    lower.includes("econnreset") ||
    lower.includes("failed to download")
  );
}

async function ffmpegPostOnce(
  url: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; text: string; json?: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": getApiKey(),
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: Record<string, unknown> | undefined;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* plain text error */
  }

  return {
    ok: res.ok,
    status: res.status,
    text,
    json,
  };
}

async function ffmpegPost(
  url: string,
  body: Record<string, unknown>,
  operation: string,
  trace?: FfmpegTraceFn
): Promise<Record<string, unknown>> {
  const apiBase = getFfmpegApiBase();
  const endpointPath = url.replace(apiBase, "") || url;

  let lastText = "";
  let lastStatus = 0;

  for (let attempt = 1; attempt <= FFMPEG_POST_RETRIES; attempt++) {
    await trace?.(
      `ffmpeg POST ${operation} attempt ${attempt}/${FFMPEG_POST_RETRIES} → ${endpointPath}\n${summarizeFfmpegBody(body)}`
    );

    const result = await ffmpegPostOnce(url, body);
    lastText = result.text;
    lastStatus = result.status;

    if (result.ok && result.json) {
      const out = parseDownloadUrl(result.json);
      await trace?.(
        `ffmpeg OK ${operation} → output ${out ? summarizeMediaUrl(out) : "(missing url in JSON)"}`
      );
      return result.json;
    }

    await trace?.(
      `ffmpeg HTTP ${operation} → status ${result.status} body_snip=${result.text.slice(0, 280).replace(/\s+/g, " ")}`
    );

    const retriable =
      attempt < FFMPEG_POST_RETRIES &&
      isRetriableFfmpegError(result.status, result.text);

    if (retriable) {
      console.warn(
        `[ffmpeg] POST ${url} attempt ${attempt}/${FFMPEG_POST_RETRIES} failed (${result.status}), retrying…`
      );
      await trace?.(`ffmpeg RETRY ${operation} after ${FFMPEG_RETRY_DELAY_MS * attempt}ms`);
      await new Promise((r) => setTimeout(r, FFMPEG_RETRY_DELAY_MS * attempt));
      continue;
    }

    await trace?.(`ffmpeg FAIL ${operation} final status=${result.status}`);
    throw new Error(`ffmpegapi POST ${url} failed (${result.status}): ${result.text}`);
  }

  await trace?.(`ffmpeg FAIL ${operation} exhausted retries status=${lastStatus}`);
  throw new Error(`ffmpegapi POST ${url} failed (${lastStatus}): ${lastText}`);
}

/** §5.5.5 — resolve aspect ratio to output dimensions */
export function getDimensions(aspectRatio: string): string {
  if (aspectRatio === "9:16") return "1080x1920";
  if (aspectRatio === "3:4") return "1080x1440";
  return "1920x1080";
}

/** §5.5.5 — outro URL based on orientation */
export function getOutroUrl(aspectRatio: string): string {
  const isPortrait = aspectRatio === "3:4" || aspectRatio === "9:16";
  return isPortrait
    ? "https://neonvideo.b-cdn.net/neonvideooutros/neonvideo_vertical.mp4"
    : "https://neonvideo.b-cdn.net/neonvideooutros/neonvideo_horizontal.mp4";
}

/**
 * Per-scene narrator mux: merge one silent Seedance video with a TTS audio track.
 * Uses /api/merge_videos (§5.5.2 step 4, §6.6 mode 1).
 */
export async function mergeVideoWithAudio(
  silentVideoUrl: string,
  audioUrl: string,
  dimensions: string,
  trace?: FfmpegTraceFn,
  sceneLabel?: string
): Promise<string> {
  const op = `merge_videos(narrator${sceneLabel ? ` ${sceneLabel}` : ""})`;
  await trace?.(`${op} silent=${summarizeMediaUrl(silentVideoUrl)}`);

  const data = await ffmpegPost(
    getFfmpegEndpoint("/api/merge_videos"),
    {
      video_urls: [silentVideoUrl],
      audio_url: audioUrl,
      dimensions,
    },
    op,
    trace
  );

  const url = parseDownloadUrl(data);
  if (!url) {
    throw new Error("No download_url from merge_videos (narrator mux)");
  }
  return url;
}

/**
 * Concat exactly two clips (no outro).
 */
async function neonvideoConcatPair(
  a: string,
  b: string,
  dimensions: string,
  trace: FfmpegTraceFn | undefined,
  operation: string,
  mirror?: NeonvideoMergeMirrorFn
): Promise<string> {
  const data = await ffmpegPost(
    getFfmpegEndpoint("/api/neonvideo_merge_videos"),
    {
      video_urls: [a, b],
      audio_url: "",
      dimensions,
      async: false,
    },
    operation,
    trace
  );

  let url = parseDownloadUrl(data);
  if (!url) {
    throw new Error("No download_url from neonvideo_merge_videos (pair concat)");
  }
  if (mirror) {
    url = await mirror(url);
  }
  return url;
}

/**
 * After binary reduction: one timeline URL (return mirrored) or neonvideo merge for ≥2 + optional watermark.
 */
async function mergeFinalTimeline(
  videoSegmentUrls: string[],
  dimensions: string,
  watermarkUrl: string | undefined,
  trace: FfmpegTraceFn | undefined,
  operation: string,
  mirror?: NeonvideoMergeMirrorFn
): Promise<string> {
  let clips = videoSegmentUrls;
  if (mirror) {
    clips = [];
    for (let i = 0; i < videoSegmentUrls.length; i++) {
      clips.push(await mirror(videoSegmentUrls[i]));
    }
  }

  if (clips.length === 0) {
    throw new Error("mergeFinalTimeline: no clips");
  }

  if (clips.length === 1) {
    return clips[0];
  }

  const body: Record<string, unknown> = {
    video_urls: clips,
    audio_url: "",
    dimensions,
    async: false,
  };
  if (watermarkUrl) body.watermark_url = watermarkUrl;

  const data = await ffmpegPost(
    getFfmpegEndpoint("/api/neonvideo_merge_videos"),
    body,
    operation,
    trace
  );
  const url = parseDownloadUrl(data);
  if (!url) {
    throw new Error("No download_url from neonvideo_merge_videos");
  }
  return url;
}

/**
 * Final timeline merge: concat all segment clips (optional watermark on multi-clip final).
 */
export async function mergeAllSegments(
  videoSegmentUrls: string[],
  dimensions: string,
  watermarkUrl?: string,
  trace?: FfmpegTraceFn,
  mirrorIntermediateUrl?: NeonvideoMergeMirrorFn
): Promise<string> {
  if (videoSegmentUrls.length === 0) {
    throw new Error("mergeAllSegments: no video URLs");
  }

  await trace?.(
    `merge tree START segments=${videoSegmentUrls.length} dimensions=${dimensions}`
  );
  videoSegmentUrls.forEach((u, idx) => {
    void trace?.(`  segment[${idx}] ${summarizeMediaUrl(u)}`);
  });

  let layer = [...videoSegmentUrls];
  let round = 0;

  while (layer.length > 1) {
    round += 1;
    await trace?.(`merge ROUND ${round} layer_size=${layer.length}`);

    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 < layer.length) {
        const op = `neonvideo_pair r${round} pair[${i}-${i + 1}]`;
        await trace?.(
          `${op} A=${summarizeMediaUrl(layer[i])}\n${op} B=${summarizeMediaUrl(layer[i + 1])}`
        );
        const merged = await neonvideoConcatPair(
          layer[i],
          layer[i + 1],
          dimensions,
          trace,
          op,
          mirrorIntermediateUrl
        );
        await trace?.(`${op} RESULT=${summarizeMediaUrl(merged)}`);
        next.push(merged);
      } else {
        await trace?.(
          `merge ROUND ${round} carry odd index ${i} ${summarizeMediaUrl(layer[i])}`
        );
        next.push(layer[i]);
      }
    }
    layer = next;
  }

  const opFinal = "final_timeline";
  await trace?.(`${opFinal} clip=${summarizeMediaUrl(layer[0])}`);

  let merged = await mergeFinalTimeline(
    layer,
    dimensions,
    watermarkUrl,
    trace,
    opFinal,
    mirrorIntermediateUrl
  );

  if (mirrorIntermediateUrl) {
    merged = await mirrorIntermediateUrl(merged);
  }

  return merged;
}

/**
 * TikTok-style captions (§5.5.6).
 * Non-fatal: caller should catch and fall back to uncaptioned URL.
 */
export async function addTikTokCaptions(
  videoUrl: string,
  aspectRatio: string,
  subtitleStyle: string = "yellow-bg",
  position: string = "bottom",
  trace?: FfmpegTraceFn
): Promise<string> {
  const mappedAspect = aspectRatio === "3:4" ? "9:16" : aspectRatio;
  const mappedStyle = subtitleStyle === "classic" ? "yellow-bg" : subtitleStyle;

  const data = await ffmpegPost(
    getFfmpegEndpoint("/api/videos/add-tiktok-captions"),
    {
      video_url: videoUrl,
      subtitle_style: mappedStyle,
      language: "auto",
      aspect_ratio: mappedAspect,
      position,
      max_chars_per_line: 50,
      max_lines: 1,
    },
    "add-tiktok-captions",
    trace
  );

  const url = parseDownloadUrl(data);
  if (!url) {
    throw new Error("No download_url from add-tiktok-captions");
  }
  return url;
}
