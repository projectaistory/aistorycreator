import { STORY_INWORLD_VOICE_IDS, STORY_VOICE_CDN_BASE } from "@/lib/constants";

export async function GET() {
  const voices = STORY_INWORLD_VOICE_IDS.map((id) => ({
    id,
    previewUrl: `${STORY_VOICE_CDN_BASE}/${id}.mp3`,
  }));

  return Response.json({ voices });
}
