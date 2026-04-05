import OpenAI from "openai";
import type { StoryCharacter, StoryScene } from "@/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateStoryScript(
  storyPrompt: string,
  durationSeconds: number,
  characters: StoryCharacter[],
  narrator: boolean
): Promise<StoryScene[]> {
  const sceneCount = Math.floor(durationSeconds / 5);

  const characterList = characters
    .map((c) => `- ${c.name}${c.prompt ? ` (${c.prompt})` : ""}`)
    .join("\n");

  const systemPrompt = `You are an expert story writer creating scripts for AI-generated video stories.
You write compelling, visual narratives broken into exactly ${sceneCount} scenes.
Each scene is exactly 5 seconds of video.
Each scene has one speaker delivering 8-20 words of dialogue or narration.
Output ONLY valid JSON with a "scenes" array.`;

  const userPrompt = `Create a ${sceneCount}-scene story (${durationSeconds} seconds total).

Story prompt: ${storyPrompt}

Characters:
${characterList}
${narrator ? "\nInclude a Narrator who sets the scene and provides transitions." : ""}

Rules:
- Each scene has exactly one speaker
- Speaker must be either "Narrator"${characters.length > 0 ? " or one of: " + characters.map((c) => `"${c.name}"`).join(", ") : ""}
- Each "audio" line must be 8-20 words (fits ~5 seconds of speech)
- Each "scene_description" should be a vivid, visual prompt for image generation (30-60 words)
- Scenes should flow as a cohesive story with a beginning, middle, and end

Return JSON in this exact format:
{
  "scenes": [
    { "id": 1, "character": "Narrator", "audio": "...", "scene_description": "..." }
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

  const parsed = JSON.parse(content);
  const scenes: StoryScene[] = (parsed.scenes || []).map(
    (s: StoryScene, i: number) => ({
      ...s,
      id: i + 1,
    })
  );

  return scenes;
}
