export const STORY_DURATION_MIN = 30;
export const STORY_DURATION_MAX = 300;
export const STORY_MAX_CHARACTERS = 3;
export const STORY_DEFAULT_ASPECT_RATIO: "16:9" | "9:16" = "9:16";
export const STORY_DEFAULT_NARRATOR_VOICE = "Alex";
export type StoryVideoModel = "seedance" | "wan-2.2" | "kling-v2.6-pro";
export const STORY_DEFAULT_VIDEO_MODEL: StoryVideoModel = "wan-2.2";
export const STORY_VIDEO_CREDITS_PER_30_SECONDS = 2000;

/** Story video output: `16:9` landscape or `9:16` portrait. Legacy `3:4` normalizes to `9:16`. */
export function normalizeStoryVideoAspectRatio(
  aspect: string | null | undefined
): "16:9" | "9:16" {
  return aspect === "16:9" ? "16:9" : "9:16";
}

/**
 * Story video model selector.
 * Legacy `videoQuality=quick` rows map to Seedance.
 */
export function normalizeStoryVideoModel(
  value: string | null | undefined
): StoryVideoModel {
  if (value === "seedance") return "seedance";
  if (value === "wan-2.2") return "wan-2.2";
  if (value === "kling-v2.6-pro") return "kling-v2.6-pro";
  if (value === "quick") return "seedance";
  return STORY_DEFAULT_VIDEO_MODEL;
}

export const STORY_VOICE_CDN_BASE =
  process.env.STORY_VOICE_CDN_BASE || "https://neonvideo.b-cdn.net/voices";

/**
 * Exact `voice_id` values accepted by WaveSpeed Inworld **1.5 Mini** TTS.
 * @see https://wavespeed.ai/docs/docs-api/inworld/inworld-inworld-1.5-mini-text-to-speech
 */
export const STORY_INWORLD_VOICE_IDS = [
  "Alex",
  "Ashley",
  "Craig",
  "Deborah",
  "Dennis",
  "Edward",
  "Elizabeth",
  "Hades",
  "Julia",
  "Pixie",
  "Mark",
  "Olivia",
  "Priya",
  "Ronald",
  "Sarah",
  "Shaun",
  "Theodore",
  "Timothy",
  "Wendy",
  "Dominus",
  "Hana",
  "Clive",
  "Carter",
  "Blake",
  "Luna",
  "Yichen",
  "Xiaoyin",
  "Xinyi",
  "Jing",
  "Erik",
  "Katrien",
  "Lennart",
  "Lore",
  "Alain",
  "Hélène",
  "Mathieu",
  "Étienne",
  "Johanna",
  "Josef",
  "Gianni",
  "Orietta",
  "Asuka",
  "Satoshi",
  "Hyunwoo",
  "Minji",
  "Seojun",
  "Yoona",
  "Szymon",
  "Wojciech",
  "Heitor",
  "Maitê",
  "Diego",
  "Lupita",
  "Miguel",
  "Rafael",
  "Svetlana",
  "Elena",
  "Dmitry",
  "Nikolai",
  "Riya",
  "Manoj",
  "Yael",
  "Oren",
  "Nour",
  "Omar",
] as const;

const INWORLD_MINI_VOICE_SET = new Set<string>(STORY_INWORLD_VOICE_IDS);

/** Map legacy / invalid UI values to a valid Mini voice (defaults to Alex). */
export function coerceInworldMiniVoiceId(
  voiceId: string | null | undefined
): string {
  const trimmed = voiceId?.trim();
  if (!trimmed) return STORY_DEFAULT_NARRATOR_VOICE;
  if (INWORLD_MINI_VOICE_SET.has(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  const byCase = STORY_INWORLD_VOICE_IDS.find(
    (id) => id.toLowerCase() === lower
  );
  return byCase ?? STORY_DEFAULT_NARRATOR_VOICE;
}

export function getStoryVideoGenerationCredits(durationSeconds: number): number {
  return Math.ceil(durationSeconds / 30) * STORY_VIDEO_CREDITS_PER_30_SECONDS;
}
