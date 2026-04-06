import rawCatalog from "@/data/character-styles.json";
import type { CharacterStyle } from "@/types";

export type CharacterStyleRow = {
  style_name: string;
  model: string;
  thumbnail: string;
  prompt_enhancer: string | null;
};

const catalog = rawCatalog as CharacterStyleRow[];

export const CHARACTER_STYLE_CDN_BASE =
  process.env.CHARACTER_STYLE_CDN_BASE?.replace(/\/$/, "") ||
  "https://neonvideo.b-cdn.net/characterpublic";

export const CHARACTER_STYLE_THUMB_FALLBACK =
  "https://via.placeholder.com/150?text=No+Image";

function thumbnailUrl(filename: string): string {
  return `${CHARACTER_STYLE_CDN_BASE}/${filename}`;
}

/** Synthetic first row — matches standalone-character-creator-porting-guide.md §3.1 */
export function getNoStyleRow(): CharacterStyle {
  return {
    style_name: "No style",
    model: "alibaba/wan-2.5/text-to-image",
    thumbnail_image: thumbnailUrl("no_style.jpg"),
    prompt_enhancer: null,
  };
}

export function rowToApiShape(row: CharacterStyleRow): CharacterStyle {
  return {
    style_name: row.style_name,
    model: row.model,
    thumbnail_image: thumbnailUrl(row.thumbnail),
    prompt_enhancer: row.prompt_enhancer,
  };
}

/** Full list for `GET /api/characters/styles`: No style first, then catalog order from guide §4. */
export function getCharacterStylesForApi(): CharacterStyle[] {
  return [getNoStyleRow(), ...catalog.map(rowToApiShape)];
}

const allowedModels = new Set<string>(
  [getNoStyleRow().model, ...catalog.map((r) => r.model)]
);

export function isAllowedCharacterModel(model: string): boolean {
  return allowedModels.has(model);
}

export function findStyleByName(styleName: string): CharacterStyle | undefined {
  if (styleName === "No style") return getNoStyleRow();
  const row = catalog.find((r) => r.style_name === styleName);
  return row ? rowToApiShape(row) : undefined;
}
