import type { StoryCharacter } from "@/types";

/** Unique speaker name for script/TTS when multiple library rows share the same display name. */
export function nextUniqueStoryCharacterName(
  baseName: string,
  existing: StoryCharacter[]
): string {
  const base = baseName.trim() || "Character";
  const taken = new Set(existing.map((c) => c.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} (${n})`)) n += 1;
  return `${base} (${n})`;
}
