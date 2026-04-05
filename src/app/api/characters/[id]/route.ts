import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, requireAuth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  const authErr = requireAuth(user);
  if (authErr) return authErr;

  const { id } = await params;

  const character = await prisma.character.findFirst({
    where: { id, userId: user!.id },
  });

  if (!character) {
    return Response.json({ error: "Character not found" }, { status: 404 });
  }

  return Response.json({ character });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  const authErr = requireAuth(user);
  if (authErr) return authErr;

  const { id } = await params;
  const data = await request.json();

  const character = await prisma.character.findFirst({
    where: { id, userId: user!.id },
  });

  if (!character) {
    return Response.json({ error: "Character not found" }, { status: 404 });
  }

  const updated = await prisma.character.update({
    where: { id },
    data: {
      name: data.name ?? character.name,
      imageUrl: data.imageUrl ?? character.imageUrl,
      prompt: data.prompt ?? character.prompt,
      style: data.style ?? character.style,
    },
  });

  return Response.json({ character: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  const authErr = requireAuth(user);
  if (authErr) return authErr;

  const { id } = await params;

  const character = await prisma.character.findFirst({
    where: { id, userId: user!.id },
  });

  if (!character) {
    return Response.json({ error: "Character not found" }, { status: 404 });
  }

  await prisma.character.delete({ where: { id } });
  return Response.json({ success: true });
}
