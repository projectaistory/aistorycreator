const WAVESPEED_BASE = "https://api.wavespeed.ai/api/v3";

function getApiKey() {
  const key = process.env.WAVESPEED_API_KEY;
  if (!key) throw new Error("WAVESPEED_API_KEY is not set");
  return key;
}

async function wavespeedPost(endpoint: string, body: Record<string, unknown>) {
  const res = await fetch(`${WAVESPEED_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WaveSpeed POST ${endpoint} failed (${res.status}): ${text}`);
  }

  return res.json();
}

async function wavespeedPoll(
  predictionId: string,
  intervalMs: number = 5000,
  maxAttempts: number = 120
): Promise<{ status: string; output?: unknown; [key: string]: unknown }> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));

    const res = await fetch(
      `${WAVESPEED_BASE}/predictions/${predictionId}/result`,
      { headers: { Authorization: `Bearer ${getApiKey()}` } }
    );

    if (!res.ok) continue;

    const data = await res.json();
    if (data.status === "completed" || data.status === "succeeded") return data;
    if (data.status === "failed" || data.status === "error") {
      throw new Error(`WaveSpeed prediction ${predictionId} failed: ${JSON.stringify(data)}`);
    }
  }

  throw new Error(`WaveSpeed prediction ${predictionId} timed out after ${maxAttempts} attempts`);
}

// ─── TTS ───

export async function generateStoryAudio(
  text: string,
  voiceId: string
): Promise<string> {
  const data = await wavespeedPost("/inworld/inworld-1.5-mini/text-to-speech", {
    text,
    voice_id: voiceId,
    speaking_rate: 1,
    temperature: 1,
  });

  const predictionId = data.data?.id || data.id;
  if (!predictionId) throw new Error("No prediction ID from TTS");

  const result = await wavespeedPoll(predictionId, 3000, 120);
  const audioUrl =
    (result.output as Record<string, string>)?.audio_url ||
    (result.output as Record<string, string>)?.url ||
    (result as Record<string, string>).audio_url;

  if (!audioUrl) throw new Error("No audio URL in TTS result");
  return audioUrl;
}

// ─── Scene Images (with character reference) ───

export async function generateSceneImages(
  descriptions: string[],
  referenceImageUrl: string,
  aspectRatio: string
): Promise<string[]> {
  const size = aspectRatio === "16:9" ? "1280x720" : "720x960";
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
        images: [referenceImageUrl],
        max_images: batch.length,
        prompt,
        size,
      }
    );

    const predictionId = data.data?.id || data.id;
    const result = await wavespeedPoll(predictionId, 5000, 120);

    const images = Array.isArray(result.output)
      ? (result.output as string[])
      : (result.output as Record<string, unknown>)?.images
        ? ((result.output as Record<string, unknown>).images as string[])
        : [];

    allImages.push(...images);
  }

  return allImages;
}

// ─── Scene Images (text-only, no character reference) ───

export async function generateSceneImagesFromText(
  descriptions: string[],
  aspectRatio: string
): Promise<string[]> {
  const size = aspectRatio === "16:9" ? "1280x720" : "720x960";
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
    });

    const predictionId = data.data?.id || data.id;
    const result = await wavespeedPoll(predictionId, 5000, 120);

    const images = Array.isArray(result.output)
      ? (result.output as string[])
      : (result.output as Record<string, unknown>)?.images
        ? ((result.output as Record<string, unknown>).images as string[])
        : [];

    allImages.push(...images);
  }

  return allImages;
}

// ─── Single Scene Image Regeneration ───

export async function generateSingleSceneImage(
  description: string,
  referenceImageUrl: string | null,
  aspectRatio: string
): Promise<string> {
  if (referenceImageUrl) {
    const images = await generateSceneImages([description], referenceImageUrl, aspectRatio);
    return images[0] || "";
  }
  const images = await generateSceneImagesFromText([description], aspectRatio);
  return images[0] || "";
}

// ─── Video Segments ───

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

  const predictionId = (data as Record<string, unknown>).data
    ? ((data as Record<string, unknown>).data as Record<string, string>).id
    : (data as Record<string, string>).id;

  const result = await wavespeedPoll(predictionId, 10000, 60);

  const videoUrl =
    (result.output as Record<string, string>)?.video_url ||
    (result.output as Record<string, string>)?.url ||
    (typeof result.output === "string" ? result.output : "");

  if (!videoUrl) throw new Error(`No video URL from ${model}`);
  return videoUrl;
}

// ─── Character Image Generation (Seedream text-to-image) ───

export async function generateCharacterImage(
  prompt: string,
  style: string = "realistic"
): Promise<string> {
  const styledPrompt = `${style} style portrait: ${prompt}`;

  const data = await wavespeedPost("/bytedance/seedream-v4/text-to-image", {
    prompt: styledPrompt,
    size: "768x1024",
    num_images: 1,
  });

  const predictionId = data.data?.id || data.id;
  if (!predictionId) throw new Error("No prediction ID from character image gen");

  const result = await wavespeedPoll(predictionId, 5000, 60);

  const images = Array.isArray(result.output)
    ? (result.output as string[])
    : (result.output as Record<string, unknown>)?.images
      ? ((result.output as Record<string, unknown>).images as string[])
      : [];

  if (!images[0]) throw new Error("No image URL in character gen result");
  return images[0];
}
