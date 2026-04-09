import { NextRequest } from "next/server";
import { getAuthUser, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function firstSceneStillUrl(sceneImagesJson: unknown): string | null {
  if (!Array.isArray(sceneImagesJson)) return null;
  for (const item of sceneImagesJson) {
    if (typeof item === "string" && item.trim().length > 0) return item.trim();
    if (item && typeof item === "object" && "url" in item) {
      const url = (item as { url: unknown }).url;
      if (typeof url === "string" && url.trim().length > 0) return url.trim();
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  const err = requireAdmin(user);
  if (err) return err;

  const [userCount, adminCount, planCount, projectCount, characterCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.plan.count(),
      prisma.project.count(),
      prisma.character.count(),
    ]);

  const recentUsers = await prisma.user.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      credits: true,
      createdAt: true,
      plan: { select: { name: true, slug: true } },
    },
  });

  const videos = await prisma.project.findMany({
    where: {
      finalVideoUrl: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      storyPrompt: true,
      finalVideoUrl: true,
      storySceneImages: true,
      createdAt: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  return Response.json({
    stats: {
      users: userCount,
      admins: adminCount,
      plans: planCount,
      projects: projectCount,
      characters: characterCount,
    },
    recentUsers: recentUsers.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
    })),
    videos: videos.map((video) => ({
      id: video.id,
      storyPrompt: video.storyPrompt,
      finalVideoUrl: video.finalVideoUrl,
      previewImageUrl: firstSceneStillUrl(video.storySceneImages),
      createdAt: video.createdAt.toISOString(),
      user: video.user,
    })),
  });
}
