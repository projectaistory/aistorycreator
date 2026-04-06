import {
  coerceInworldMiniVoiceId,
  STORY_DEFAULT_NARRATOR_VOICE,
  STORY_INWORLD_VOICE_IDS,
} from "@/lib/constants";
import type { StoryCharacter, StoryScene } from "@/types";

const UNIQ_SUFFIX = /^(.+?)\s*\((\d+)\)\s*$/;

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[b.length];
}

/**
 * Map speaker label from the model to a canonical cast name (exact library `name`).
 */
export function resolveCanonicalSpeaker(
  raw: string,
  characterNames: string[],
  narratorAllowed: boolean
): string {
  const t = raw.trim();
  if (!t) {
    return narratorAllowed
      ? "Narrator"
      : characterNames[0] ?? STORY_DEFAULT_NARRATOR_VOICE;
  }
  if (/^narrator$/i.test(t)) {
    return narratorAllowed ? "Narrator" : characterNames[0] ?? "Narrator";
  }

  const lower = t.toLowerCase();
  for (const n of characterNames) {
    const nt = n.trim();
    if (nt.toLowerCase() === lower) return nt;
  }
  for (const n of characterNames) {
    const nt = n.trim();
    const m = UNIQ_SUFFIX.exec(nt);
    const base = m ? m[1].trim() : nt;
    if (base.toLowerCase() === lower) return nt;
  }

  const prefixHits = characterNames.filter(
    (n) =>
      n.toLowerCase().startsWith(lower) || lower.startsWith(n.toLowerCase())
  );
  if (prefixHits.length === 1) return prefixHits[0].trim();

  let best: string | null = null;
  let bestDist = Infinity;
  for (const n of characterNames) {
    const nt = n.trim();
    const maxTypos = Math.min(3, Math.max(1, Math.floor(nt.length / 4)));
    const d = levenshtein(lower, nt.toLowerCase());
    if (d < bestDist && d <= maxTypos) {
      bestDist = d;
      best = nt;
    }
  }
  if (best) return best;

  return t;
}

/** Every cast member gets a voice: explicit `voiceId` or a stable default by index. */
export function buildVoiceMap(characters: StoryCharacter[]): Record<string, string> {
  const voiceMap: Record<string, string> = {};
  characters.forEach((c, i) => {
    const voice = c.voiceId?.trim()
      ? coerceInworldMiniVoiceId(c.voiceId)
      : STORY_INWORLD_VOICE_IDS[i % STORY_INWORLD_VOICE_IDS.length];
    voiceMap[c.name.trim()] = voice;
  });
  return voiceMap;
}

export function buildVoiceByCharacterId(
  characters: StoryCharacter[]
): Record<string, string> {
  const out: Record<string, string> = {};
  characters.forEach((c, i) => {
    if (!c.id) return;
    const voice = c.voiceId?.trim()
      ? coerceInworldMiniVoiceId(c.voiceId)
      : STORY_INWORLD_VOICE_IDS[i % STORY_INWORLD_VOICE_IDS.length];
    out[c.id] = voice;
  });
  return out;
}

export function isNarratorCharacter(character: string | undefined | null): boolean {
  return Boolean(character?.trim() && /^narrator$/i.test(character.trim()));
}

export function resolveVoiceIdForScene(
  scene: StoryScene,
  voiceMap: Record<string, string>,
  voiceByCharacterId: Record<string, string>,
  narratorVoice: string | null
): string {
  const narrator = coerceInworldMiniVoiceId(narratorVoice);

  if (isNarratorCharacter(scene.character)) {
    return narrator;
  }

  const cid = scene.characterId?.trim();
  if (cid && voiceByCharacterId[cid]) {
    return voiceByCharacterId[cid];
  }

  const name = scene.character.trim();
  const direct = voiceMap[name];
  if (direct) return direct;
  const lower = name.toLowerCase();
  const hit = Object.keys(voiceMap).find((k) => k.toLowerCase() === lower);
  if (hit) return voiceMap[hit];

  return coerceInworldMiniVoiceId(null);
}

/** Loose scene row from the model before normalization. */
export type StorySceneGenerationRaw = {
  id?: number;
  character?: string;
  audio?: string;
  scene_description?: string;
  character_id?: string | null;
  characterId?: string | null;
};

/** Normalize scenes from OpenAI: canonical names, stable `characterId`, Narrator handling. */
export function finalizeScenesAfterGeneration(
  rawScenes: StorySceneGenerationRaw[],
  characters: StoryCharacter[],
  narrator: boolean
): StoryScene[] {
  const names = characters.map((c) => c.name.trim());
  return rawScenes.map((s, i) => {
    const rawId =
      (typeof s.character_id === "string" && s.character_id.trim()) ||
      (typeof s.characterId === "string" && s.characterId.trim()) ||
      null;

    let character = String(s.character ?? "").trim();
    let characterId: string | null = null;

    if (rawId && characters.some((c) => c.id === rawId)) {
      const c = characters.find((x) => x.id === rawId)!;
      character = c.name.trim();
      characterId = rawId;
    } else {
      character = resolveCanonicalSpeaker(character, names, narrator);
      if (character !== "Narrator") {
        const match = characters.find((c) => c.name.trim() === character);
        if (match?.id) characterId = match.id;
      }
    }

    return {
      id: i + 1,
      character,
      audio: String(s.audio ?? ""),
      scene_description: String(s.scene_description ?? ""),
      characterId,
    };
  });
}
