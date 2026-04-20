import { Agent, fetch as undiciFetch } from "undici";
import { coerceInworldMiniVoiceId } from "@/lib/constants";
import { getWaveSpeedApiKey } from "@/lib/site-settings";

const WAVESPEED_BASE = "https://api.wavespeed.ai/api/v3";

/**
 * Node’s global `fetch` uses a ~10s connect timeout; WaveSpeed polls often need longer
 * (slow TLS / geo routing). Undici Agent raises limits for all WaveSpeed calls.
 */
const wavespeedAgent = new Agent({
  connectTimeout: 180_000,
  headersTimeout: 600_000,
  bodyTimeout: 600_000,
  keepAliveTimeout: 120_000,
});

type UndiciResponse = Awaited<ReturnType<typeof undiciFetch>>;

async function wavespeedFetch(
  url: string,
  init?: Parameters<typeof undiciFetch>[1]
): Promise<UndiciResponse> {
  return undiciFetch(url, {
    ...init,
    dispatcher: wavespeedAgent,
  });
}

/** WaveSpeed expects size like "2048*2048", not "2048x2048" (per official docs). */
function toWavespeedSize(wxh: string): string {
  return wxh.trim().toLowerCase().includes("*")
    ? wxh
    : wxh.replace(/x/gi, "*");
}

/**
 * Resolve the WaveSpeed API key per request so admins can rotate it from the
 * dashboard. {@link getWaveSpeedApiKey} reads the DB setting first and falls
 * back to the legacy WAVESPEED_API_KEY env var.
 */
async function getApiKey(): Promise<string> {
  const key = (await getWaveSpeedApiKey()).trim();
  if (!key) {
    throw new Error(
      "WaveSpeed API key is not configured. Set integrations.wavespeed.api_key in the admin dashboard or WAVESPEED_API_KEY in the environment."
    );
  }
  return key;
}

async function wavespeedPost(endpoint: string, body: Record<string, unknown>) {
  const apiKey = await getApiKey();
  const res = await wavespeedFetch(`${WAVESPEED_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WaveSpeed POST ${endpoint} failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<Record<string, unknown>>;
}

function getPredictionId(data: Record<string, unknown>): string {
  const inner = data.data as Record<string, unknown> | undefined;
  const id = inner?.id ?? data.id;
  return typeof id === "string" ? id : "";
}

/**
 * Poll result: response is often `{ code, message, data: { status, outputs, ... } }`.
 * See WaveSpeed "Get the result" docs for each model.
 */
async function wavespeedPoll(
  predictionId: string,
  intervalMs: number = 5000,
  maxAttempts: number = 120
): Promise<Record<string, unknown>> {
  const apiKey = await getApiKey();
  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    let res: UndiciResponse;
    try {
      res = await wavespeedFetch(
        `${WAVESPEED_BASE}/predictions/${predictionId}/result`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
    } catch (err) {
      console.warn(
        `[wavespeed] poll ${i + 1}/${maxAttempts} fetch failed (${predictionId}):`,
        err instanceof Error ? err.message : err
      );
      continue;
    }

    if (!res.ok) continue;

    let body: Record<string, unknown>;
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch (parseErr) {
      console.warn(
        `[wavespeed] poll ${i + 1}/${maxAttempts} invalid JSON (${predictionId}):`,
        parseErr
      );
      continue;
    }
    const payload =
      body.data && typeof body.data === "object"
        ? (body.data as Record<string, unknown>)
        : body;

    const status = String(payload.status ?? "").toLowerCase();
    if (
      status === "completed" ||
      status === "succeeded" ||
      status === "success"
    ) {
      const outputs = payload.outputs;
      const normalizedOutput = Array.isArray(outputs)
        ? outputs
        : payload.output ?? outputs;
      return { ...payload, output: normalizedOutput, outputs };
    }
    if (status === "failed" || status === "error") {
      const errMsg =
        typeof payload.error === "string" && payload.error
          ? payload.error
          : JSON.stringify(body);
      throw new Error(
        `WaveSpeed prediction ${predictionId} failed: ${errMsg}`
      );
    }
  }

  throw new Error(
    `WaveSpeed prediction ${predictionId} timed out after ${maxAttempts} attempts`
  );
}

function imageUrlFromOutputItem(item: unknown): string | null {
  if (typeof item === "string" && item.startsWith("http")) return item;
  if (item && typeof item === "object" && "url" in item) {
    const u = (item as { url?: unknown }).url;
    if (typeof u === "string" && u.startsWith("http")) return u;
  }
  return null;
}

function collectImageUrlsFromArray(arr: unknown[]): string[] {
  const urls: string[] = [];
  for (const item of arr) {
    const u = imageUrlFromOutputItem(item);
    if (u) urls.push(u);
  }
  return urls;
}

function extractImageUrls(result: Record<string, unknown>): string[] {
  const out = result.output;
  if (typeof out === "string" && out.startsWith("http")) return [out];
  if (Array.isArray(out)) {
    const fromArr = collectImageUrlsFromArray(out as unknown[]);
    if (fromArr.length > 0) return fromArr;
  }
  if (out && typeof out === "object" && "images" in out) {
    const imgs = (out as { images?: unknown }).images;
    if (Array.isArray(imgs)) {
      const fromImgs = collectImageUrlsFromArray(imgs);
      if (fromImgs.length > 0) return fromImgs;
    }
  }
  const outputs = result.outputs;
  if (Array.isArray(outputs)) {
    return collectImageUrlsFromArray(outputs);
  }
  return [];
}

function firstHttpStringFromOutputs(outputs: unknown): string {
  if (!Array.isArray(outputs)) return "";
  for (const item of outputs) {
    if (typeof item === "string" && item.startsWith("http")) return item;
    if (item && typeof item === "object" && "url" in item) {
      const u = (item as { url?: unknown }).url;
      if (typeof u === "string" && u.startsWith("http")) return u;
    }
  }
  return "";
}

function extractAudioUrl(result: Record<string, unknown>): string {
  const fromOutputs = firstHttpStringFromOutputs(result.outputs);
  if (fromOutputs) return fromOutputs;

  const out = result.output;
  if (typeof out === "string" && out.startsWith("http")) return out;
  if (Array.isArray(out)) {
    const u = firstHttpStringFromOutputs(out);
    if (u) return u;
    if (typeof out[0] === "string") return out[0];
  }
  if (out && typeof out === "object") {
    const o = out as Record<string, string>;
    if (o.audio_url) return o.audio_url;
    if (o.url) return o.url;
  }
  const top = result.audio_url;
  if (typeof top === "string") return top;
  return "";
}

/** POST body may already be `completed` with `data.outputs` (WaveSpeed TTS docs). */
function tryAudioUrlFromSubmitResponse(
  data: Record<string, unknown>
): string | null {
  const inner = data.data as Record<string, unknown> | undefined;
  const payload =
    inner && typeof inner === "object" ? inner : (data as Record<string, unknown>);
  const status = String(payload.status ?? "").toLowerCase();
  if (
    status !== "completed" &&
    status !== "succeeded" &&
    status !== "success"
  ) {
    return null;
  }
  const merged = { ...payload, output: payload.outputs ?? payload.output };
  const url = extractAudioUrl(merged);
  return url || null;
}

function extractVideoUrl(result: Record<string, unknown>): string {
  const out = result.output;
  if (typeof out === "string" && out.startsWith("http")) return out;
  if (Array.isArray(out) && typeof out[0] === "string") return out[0];
  if (out && typeof out === "object") {
    const o = out as Record<string, string>;
    if (o.video_url) return o.video_url;
    if (o.url) return o.url;
  }
  const outputs = result.outputs;
  if (Array.isArray(outputs) && typeof outputs[0] === "string") return outputs[0];
  return "";
}

// ─── TTS (porting guide §6.2) ───

export async function generateStoryAudio(
  text: string,
  voiceId: string
): Promise<string> {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) {
    throw new Error("TTS text is empty");
  }

  const safeVoiceId = coerceInworldMiniVoiceId(voiceId);

  const data = await wavespeedPost("/inworld/inworld-1.5-mini/text-to-speech", {
    text: trimmed,
    voice_id: safeVoiceId,
    speaking_rate: 1,
    temperature: 1,
  });

  const syncUrl = tryAudioUrlFromSubmitResponse(data);
  if (syncUrl) return syncUrl;

  const predictionId = getPredictionId(data);
  if (!predictionId) {
    throw new Error(
      `No prediction ID from TTS submit: ${JSON.stringify(data).slice(0, 500)}`
    );
  }

  const result = await wavespeedPoll(predictionId, 3000, 120);
  const audioUrl = extractAudioUrl(result);
  if (!audioUrl) {
    throw new Error(
      `No audio URL in TTS result (prediction ${predictionId}): ${JSON.stringify(result).slice(0, 800)}`
    );
  }
  return audioUrl;
}

/** Seedream sequential / edit-sequential — API rejects many sizes; use allowed pairs only. */
function seedreamSequentialSceneSize(aspectRatio: string): string {
  if (aspectRatio === "16:9") return "2560*1440";
  // 9:16 portrait; legacy 3:4 stored on old projects maps to the same tall frame
  return "1440*2560";
}

// ─── Scene Images with reference (guide §6.3) ───

export async function generateSceneImages(
  descriptions: string[],
  referenceImageUrls: string | string[],
  aspectRatio: string
): Promise<string[]> {
  const urls = Array.isArray(referenceImageUrls)
    ? referenceImageUrls
    : [referenceImageUrls];
  const size = seedreamSequentialSceneSize(aspectRatio);
  const allImages: string[] = [];
  const batchSize = 12;

  for (let i = 0; i < descriptions.length; i += batchSize) {
    const batch = descriptions.slice(i, i + batchSize);
    const prompt = batch
      .map((d, idx) => `Image ${i + idx + 1}: ${d}`)
      .join("\n");

    const data = await wavespeedPost(
      "/bytedance/seedream-v4.5/edit-sequential",
      {
        images: urls.slice(0, 10),
        max_images: batch.length,
        prompt,
        size,
        enable_base64_output: false,
        enable_sync_mode: false,
      }
    );

    const predictionId = getPredictionId(data);
    const result = await wavespeedPoll(predictionId, 5000, 120);
    const images = extractImageUrls(result);
    allImages.push(...images);
  }

  return allImages;
}

// ─── Scene Images text-only (guide §6.4) ───

export async function generateSceneImagesFromText(
  descriptions: string[],
  aspectRatio: string
): Promise<string[]> {
  const size = seedreamSequentialSceneSize(aspectRatio);
  const allImages: string[] = [];
  const batchSize = 12;

  for (let i = 0; i < descriptions.length; i += batchSize) {
    const batch = descriptions.slice(i, i + batchSize);
    const prompt = batch
      .map((d, idx) => `Image ${i + idx + 1}: ${d}`)
      .join("\n");

    const data = await wavespeedPost("/bytedance/seedream-v4/sequential", {
      max_images: batch.length,
      prompt,
      size,
      enable_base64_output: false,
      enable_sync_mode: false,
    });

    const predictionId = getPredictionId(data);
    const result = await wavespeedPoll(predictionId, 5000, 120);
    const images = extractImageUrls(result);
    allImages.push(...images);
  }

  return allImages;
}

// ─── Single Scene Image Regeneration ───

export async function generateSingleSceneImage(
  description: string,
  referenceImageUrls: string | string[] | null,
  aspectRatio: string
): Promise<string> {
  if (referenceImageUrls) {
    const images = await generateSceneImages(
      [description],
      referenceImageUrls,
      aspectRatio
    );
    return images[0] || "";
  }
  const images = await generateSceneImagesFromText([description], aspectRatio);
  return images[0] || "";
}

// ─── Video Segments (guide §6.5) ───

export async function generateVideoSegment(
  model: "infinitetalk" | "seedance",
  imageUrl: string,
  prompt: string,
  audioUrl?: string,
  aspectRatio: string = "16:9"
): Promise<string> {
  let data: Record<string, unknown>;

  if (model === "infinitetalk") {
    data = await wavespeedPost("/wavespeed-ai/infinitetalk-fast", {
      audio: audioUrl || "",
      image: imageUrl,
      prompt,
      seed: Math.floor(Math.random() * 999999),
    });
  } else {
    const duration = 6;
    data = await wavespeedPost(
      "/bytedance/seedance-v1.5-pro/image-to-video-fast",
      {
        image: imageUrl,
        prompt,
        duration,
        aspect_ratio: aspectRatio,
        generate_audio: false,
      }
    );
  }

  const predictionId = getPredictionId(data);
  // Video generation can run well past 10 minutes under provider load.
  const result = await wavespeedPoll(predictionId, 10000, 120);
  const videoUrl = extractVideoUrl(result);
  if (!videoUrl) throw new Error(`No video URL from ${model}`);
  return videoUrl;
}

/** Aspect → size — standalone-character-creator-porting-guide.md §5.1 */
const CHARACTER_ASPECT_TO_SIZE: Record<string, string> = {
  "1:1": "1024*1024",
  "16:9": "1280*720",
  "9:16": "720*1280",
  "4:3": "1152*864",
  "3:4": "864*1152",
};

export type CharacterPortraitOptions = {
  userPrompt: string;
  model: string;
  aspectRatio?: string;
  promptEnhancer?: string | null;
};

/**
 * Character generate — `POST https://api.wavespeed.ai/api/v3/{model}` with model-specific body.
 * @see standalone-character-creator-porting-guide.md §5.1
 */
export async function generateCharacterPortraitWithModel(
  options: CharacterPortraitOptions
): Promise<string> {
  const {
    userPrompt,
    model,
    aspectRatio = "3:4",
    promptEnhancer,
  } = options;

  const size =
    CHARACTER_ASPECT_TO_SIZE[aspectRatio] ?? CHARACTER_ASPECT_TO_SIZE["3:4"];
  const fullPrompt = `front shot of a ${userPrompt}${
    promptEnhancer ? `, ${promptEnhancer}` : ""
  }`;

  const base: Record<string, unknown> = {
    enable_base64_output: false,
    enable_sync_mode: false,
    prompt: fullPrompt,
    size,
  };

  let body: Record<string, unknown> = { ...base };

  if (model === "z-ai/cogview-4") {
    body = { ...body, quality: "hd" };
  } else if (model === "wavespeed-ai/qwen-image/text-to-image-2512-lora") {
    body = { ...body, loras: [], output_format: "jpeg", seed: -1 };
  } else if (model === "alibaba/wan-2.5/text-to-image") {
    body = { ...body, enable_prompt_expansion: false, seed: -1 };
  }

  const path = model.startsWith("/") ? model : `/${model}`;
  const data = await wavespeedPost(path, body);
  const predictionId = getPredictionId(data);
  if (!predictionId) {
    throw new Error(`No prediction ID from character generation (${model})`);
  }

  const result = await wavespeedPoll(predictionId, 5000, 120);
  const images = extractImageUrls(result);
  if (!images[0]) {
    throw new Error("No image URL in character generation result");
  }
  return images[0];
}

/** Legacy Seedream-only path (no style catalog). */
export async function generateCharacterImage(
  prompt: string,
  style: string = "realistic"
): Promise<string> {
  const styledPrompt = `${style} style portrait: ${prompt}`;

  const data = await wavespeedPost("/bytedance/seedream-v4", {
    prompt: styledPrompt,
    size: toWavespeedSize("1152x1536"),
    enable_base64_output: false,
    enable_sync_mode: false,
  });

  const predictionId = getPredictionId(data);
  if (!predictionId) throw new Error("No prediction ID from character image gen");

  const result = await wavespeedPoll(predictionId, 5000, 60);
  const images = extractImageUrls(result);
  if (!images[0]) throw new Error("No image URL in character gen result");
  return images[0];
}
