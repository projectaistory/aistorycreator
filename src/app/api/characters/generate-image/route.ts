import { NextRequest } from "next/server";
import { getAuthUser, requireAuth } from "@/lib/auth";
import {
  isAllowedCharacterModel,
  findStyleByName,
} from "@/lib/characterStyles";
import { generateCharacterPortraitWithModel } from "@/services/wavespeed";
import { ensureUrlOnBunnyStorage } from "@/services/bunnyStorage";

const ASPECT_RATIOS = new Set(["1:1", "16:9", "9:16", "4:3", "3:4"]);

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  const authErr = requireAuth(user);
  if (authErr) return authErr;

  const body = await request.json();
  const {
    prompt,
    model: bodyModel,
    style: styleName,
    promptEnhancer: bodyEnhancer,
    aspectRatio: rawAspect,
  } = body as {
    prompt?: string;
    model?: string;
    style?: string;
    promptEnhancer?: string | null;
    aspectRatio?: string;
  };

  const trimmed = prompt?.trim() ?? "";
  if (!trimmed) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }
  if (trimmed.length <= 10) {
    return Response.json(
      { error: "Prompt should be longer than 10 characters" },
      { status: 400 }
    );
  }

  let model: string | undefined = bodyModel;
  let promptEnhancer: string | null | undefined = bodyEnhancer;

  if (styleName) {
    const row = findStyleByName(styleName);
    if (!row) {
      return Response.json({ error: "Unknown style" }, { status: 400 });
    }
    if (model && model !== row.model) {
      return Response.json(
        { error: "Model does not match selected style" },
        { status: 400 }
      );
    }
    model = row.model;
    if (bodyEnhancer === undefined) {
      promptEnhancer = row.prompt_enhancer;
    }
  } else if (!model) {
    return Response.json(
      { error: "style (style_name) or model is required" },
      { status: 400 }
    );
  }

  if (!model || !isAllowedCharacterModel(model)) {
    return Response.json({ error: "Invalid model" }, { status: 400 });
  }

  const aspectRatio =
    rawAspect && ASPECT_RATIOS.has(rawAspect) ? rawAspect : "3:4";

  try {
    const generatedImageUrl = await generateCharacterPortraitWithModel({
      userPrompt: trimmed,
      model,
      aspectRatio,
      promptEnhancer: promptEnhancer ?? null,
    });
    const imageUrl = await ensureUrlOnBunnyStorage(generatedImageUrl, {
      folderEnvVar: "BUNNY_STORAGE_CHARACTERS_PATH",
      defaultFolder: "characters",
      preferredExt: "jpg",
      contentType: "image/jpeg",
      label: "character-image",
      maxBytes: 40 * 1024 * 1024,
    });
    return Response.json({ imageUrl, prompt: trimmed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
