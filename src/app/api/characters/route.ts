import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, requireAuth } from "@/lib/auth";
import {
  FREE_PLAN_MAX_SAVED_CHARACTERS,
  isFreePlanSlug,
} from "@/lib/planLimits";

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  const authErr = requireAuth(user);
  if (authErr) return authErr;

  const characters = await prisma.character.findMany({
    where: { userId: user!.id },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ characters });
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  const authErr = requireAuth(user);
  if (authErr) return authErr;

  const { name, imageUrl, prompt, style } = await request.json();

  if (!name || !imageUrl) {
    return Response.json(
      { error: "Name and imageUrl are required" },
      { status: 400 }
    );
  }

  const me = await prisma.user.findUnique({
    where: { id: user!.id },
    select: {
      plan: { select: { slug: true } },
      _count: { select: { characters: true } },
    },
  });

  if (
    me &&
    isFreePlanSlug(me.plan?.slug) &&
    me._count.characters >= FREE_PLAN_MAX_SAVED_CHARACTERS
  ) {
    return Response.json(
      {
        error: `Free plan includes up to ${FREE_PLAN_MAX_SAVED_CHARACTERS} saved characters. Delete one to add another, or upgrade your plan.`,
        freePlanMaxCharacters: FREE_PLAN_MAX_SAVED_CHARACTERS,
      },
      { status: 403 }
    );
  }

  const character = await prisma.character.create({
    data: {
      userId: user!.id,
      name,
      imageUrl,
      prompt: prompt || "",
      style: style || null,
    },
  });

  return Response.json({ character }, { status: 201 });
}
