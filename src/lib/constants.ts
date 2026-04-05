export const STORY_DURATION_MIN = 30;
export const STORY_DURATION_MAX = 300;
export const STORY_MAX_CHARACTERS = 3;
export const STORY_DEFAULT_NARRATOR_VOICE = "Alex";
export const STORY_VIDEO_CREDITS_PER_30_SECONDS = 2000;

export const STORY_VOICE_CDN_BASE =
  process.env.STORY_VOICE_CDN_BASE || "https://neonvideo.b-cdn.net/voices";

export const STORY_INWORLD_VOICE_IDS = [
  "Alex",
  "Olivia",
  "James",
  "Sophia",
  "Michael",
  "Emma",
  "Daniel",
  "Isabella",
  "David",
  "Mia",
  "Ethan",
  "Charlotte",
];

export function getStoryVideoGenerationCredits(durationSeconds: number): number {
  return Math.ceil(durationSeconds / 30) * STORY_VIDEO_CREDITS_PER_30_SECONDS;
}
