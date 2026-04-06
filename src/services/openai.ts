import OpenAI from "openai";
import type { StoryCharacter, StoryScene } from "@/types";
import {
  finalizeScenesAfterGeneration,
  type StorySceneGenerationRaw,
} from "@/lib/storyTtsVoices";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateStoryScript(
  storyPrompt: string,
  durationSeconds: number,
  characters: StoryCharacter[],
  narrator: boolean
): Promise<StoryScene[]> {
  const sceneCount = Math.floor(durationSeconds / 5);

  const characterBlock = characters
    .map((c) => {
      const idPart = c.id ? `character_id: "${c.id}"` : "character_id: (missing)";
      return `- ${idPart}, speaker_name (exact string): "${c.name}"${c.prompt ? ` — ${c.prompt}` : ""}`;
    })
    .join("\n");

  const allowedNames =
    characters.length > 0
      ? characters.map((c) => `"${c.name}"`).join(", ")
      : "(no cast)";

  const systemPrompt = `You are an expert story writer creating scripts for AI-generated video stories.
You write compelling, visual narratives broken into exactly ${sceneCount} scenes.
Each scene is exactly 5 seconds of video.
Each scene has one speaker delivering 8-20 words of dialogue or narration.
Output ONLY valid JSON with a "scenes" array.`;

  const userPrompt = `Create a ${sceneCount}-scene story (${durationSeconds} seconds total).

Story prompt: ${storyPrompt}

Cast (use these exact speaker_name strings and character_id values for non-Narrator scenes):
${characterBlock || "(none)"}
${narrator ? "\nAlso use a Narrator for scene-setting and transitions where appropriate." : "\nDo not use a Narrator; only the cast members above may speak."}

Rules:
- Each scene has exactly one speaker.
- The "character" field MUST be exactly one of: ${narrator ? `"Narrator" or ` : ""}${allowedNames} — copy the speaker_name verbatim, including any "(2)" style suffixes.
- For every scene where "character" is not "Narrator", set "character_id" to the matching id from the cast list above. For Narrator scenes, set "character_id" to null.
- Do not put speaker names inside "audio" (dialogue only; names are not spoken).
- Each "audio" line must be 8-20 words (fits ~5 seconds of speech).
- Each "scene_description" should be a vivid, visual prompt for image generation (30-60 words).
- Scenes should flow as a cohesive story with a beginning, middle, and end.

Return JSON in this exact shape:
{
  "scenes": [
    { "id": 1, "character": "Narrator", "character_id": null, "audio": "...", "scene_description": "..." }
  ]
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.8,
    max_tokens: 4000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No response from OpenAI");

  const parsed = JSON.parse(content) as { scenes?: StorySceneGenerationRaw[] };
  return finalizeScenesAfterGeneration(parsed.scenes || [], characters, narrator);
}
