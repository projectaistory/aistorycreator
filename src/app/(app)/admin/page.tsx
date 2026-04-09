"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, Shield, CreditCard, Film, UserCircle, Sparkles, Play } from "lucide-react";
import { StoryCardThumbnail } from "@/components/stories/story-card-thumbnail";

type OverviewResponse = {
  stats: {
    users: number;
    admins: number;
    plans: number;
    projects: number;
    characters: number;
  };
  recentUsers: Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    credits: number;
    createdAt: string;
    plan: { name: string; slug: string } | null;
  }>;
  videos: Array<{
    id: string;
    storyPrompt: string | null;
    finalVideoUrl: string | null;
    previewImageUrl: string | null;
    createdAt: string;
    user: {
      name: string;
      email: string;
    };
  }>;
};

export default function AdminOverviewPage() {
  const [playback, setPlayback] = useState<{
    url: string;
    title: string;
  } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => apiRequest<OverviewResponse>("/api/admin/overview"),
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 rounded-xl bg-muted/50" />
        <div className="h-48 rounded-xl bg-muted/50" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="text-destructive text-sm">
        Could not load overview. Check that you are signed in as an admin.
      </p>
    );
  }

  const { stats, recentUsers, videos } = data;

  return (
    <div className="space-y-8">
      <Dialog
        open={!!playback}
        onOpenChange={(open) => {
          if (!open) setPlayback(null);
        }}
      >
        <DialogContent
          className="max-h-[min(92vh,900px)] w-[min(960px,calc(100vw-1.5rem))] max-w-[min(960px,calc(100vw-1.5rem))] gap-0 overflow-hidden p-0 sm:max-w-[min(960px,calc(100vw-1.5rem))]"
          showCloseButton
        >
          {playback && (
            <>
              <DialogHeader className="space-y-1 border-b border-border/60 px-4 py-3 text-left">
                <DialogTitle className="pr-8 text-base leading-snug line-clamp-2">
                  {playback.title}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Video playback
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center justify-center bg-black px-2 py-3">
                <video
                  key={playback.url}
                  src={playback.url}
                  controls
                  playsInline
                  preload="metadata"
                  className="aspect-video max-h-[min(72vh,640px)] w-full max-w-full object-contain"
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-border/60 bg-gradient-to-br from-violet-500/10 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="size-4" /> Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{stats.users}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Shield className="size-4" /> Admins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{stats.admins}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CreditCard className="size-4" /> Plans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{stats.plans}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Film className="size-4" /> Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{stats.projects}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserCircle className="size-4" /> Characters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{stats.characters}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Recent users
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users yet.</p>
          ) : (
            recentUsers.map((u) => (
              <div
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/50 bg-card/50 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-sm text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>
                    {u.role}
                  </Badge>
                  {u.plan && (
                    <Badge variant="outline">{u.plan.name}</Badge>
                  )}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {u.credits.toLocaleString()} credits
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="size-5 text-primary" />
            All created videos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {videos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No videos created yet.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {videos.map((video) => (
                <li key={video.id} className="overflow-hidden rounded-lg border border-border/60 bg-card">
                  <div className="relative aspect-video bg-muted">
                    {video.finalVideoUrl ? (
                      <button
                        type="button"
                        className="absolute inset-0 block w-full border-0 bg-transparent p-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
                        aria-label={`Play video: ${video.storyPrompt?.trim() || "Untitled story"}`}
                        onClick={() =>
                          setPlayback({
                            url: video.finalVideoUrl!,
                            title: video.storyPrompt?.trim() || "Untitled story",
                          })
                        }
                      >
                        <StoryCardThumbnail
                          previewImageUrl={video.previewImageUrl}
                          videoUrl={video.finalVideoUrl}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
                          <div className="rounded-full bg-background/90 p-3 shadow-md">
                            <Play className="size-6 text-foreground" />
                          </div>
                        </div>
                      </button>
                    ) : video.previewImageUrl ? (
                      <img
                        src={video.previewImageUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                        <Film className="size-10 opacity-40" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 p-3">
                    <p className="line-clamp-2 text-sm font-medium">
                      {video.storyPrompt?.trim() || "Untitled story"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {video.user.name} ({video.user.email})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(video.createdAt).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
