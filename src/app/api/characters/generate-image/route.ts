import { NextRequest } from "next/server";
import { getAuthUser, requireAuth } from "@/lib/auth";
import { generateCharacterImage } from "@/services/wavespeed";

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  const authErr = requireAuth(user);
  if (authErr) return authErr;

  const { prompt, style } = await request.json();

  if (!prompt) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  try {
    const imageUrl = await generateCharacterImage(prompt, style || "realistic");
    return Response.json({ imageUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
