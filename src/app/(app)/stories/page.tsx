"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PlusCircle,
  Film,
  Play,
  Clock,
  CheckCircle,
  Loader2,
  AlertCircle,
  Trash2,
  Download,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import type { Character } from "@/types";
import { normalizeStoryVideoAspectRatio } from "@/lib/constants";

interface ProjectListItem {
  id: string;
  storyPrompt: string | null;
  storyDuration: number;
  generationStatus: string | null;
  finalVideoUrl: string | null;
  isCompleted: boolean;
  currentStep: number;
  createdAt: string;
  aspectRatio: string;
  /** First scene still; used when final video is not ready yet */
  previewImageUrl: string | null;
}

/**
 * Seek URL for inline `<video>` thumbnails when no scene still is available.
 * Slightly past t=0 avoids all-black first frames that some encoders emit before the first keyframe.
 */
function storyVideoThumbnailSrc(videoUrl: string): string {
  const u = videoUrl.trim();
  if (!u) return u;
  const hash = u.includes("#") ? "" : "#t=0.25";
  return `${u}${hash}`;
}

type PlaybackState = {
  id: string;
  url: string;
  title: string;
  aspectRatio: string;
};

function storyStatusLabel(p: ProjectListItem): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: typeof CheckCircle;
} {
  if (p.finalVideoUrl && p.isCompleted) {
    return { label: "Ready", variant: "default", icon: CheckCircle };
  }
  if (p.generationStatus === "failed") {
    return { label: "Failed", variant: "destructive", icon: AlertCircle };
  }
  if (
    p.generationStatus === "generating" ||
    p.generationStatus === "generating_video"
  ) {
    return { label: "Generating", variant: "secondary", icon: Loader2 };
  }
  return { label: "Draft", variant: "outline", icon: Clock };
}

export default function StoriesPage() {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);

  const { data: charData } = useQuery({
    queryKey: ["characters"],
    queryFn: () => apiRequest<{ characters: Character[] }>("/api/characters"),
  });

  const {
    data: projectsData,
    isLoading: projectsLoading,
    isError: projectsError,
  } = useQuery({
    queryKey: ["projects", "story_video"],
    queryFn: () =>
      apiRequest<{ projects: ProjectListItem[] }>("/api/projects?type=story_video"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ success: boolean }>(`/api/projects/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", "story_video"] });
      toast.success("Story deleted");
      setDeleteId(null);
    },
    onError: () => {
      toast.error("Could not delete this story. Try again.");
    },
  });

  const hasCharacters = (charData?.characters?.length || 0) > 0;
  const projects = projectsData?.projects ?? [];
  const deleteTarget = deleteId
    ? projects.find((p) => p.id === deleteId)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Stories</h1>
          <p className="text-sm text-muted-foreground">
            Your AI-generated story videos
          </p>
        </div>
        <Link href={hasCharacters ? "/stories/create" : "/characters/create"}>
          <Button className="gap-2">
            <PlusCircle className="w-4 h-4" />
            {hasCharacters ? "Create Story" : "Create Character First"}
          </Button>
        </Link>
      </div>

      <Dialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeleteId(null);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!deleteMutation.isPending}>
          <DialogHeader>
            <DialogTitle>Delete this story?</DialogTitle>
            <DialogDescription>
              This removes the story from your account. Files on storage may
              remain until removed separately. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <p className="text-sm text-foreground/90 rounded-md border bg-muted/40 px-3 py-2 line-clamp-3">
              {(deleteTarget.storyPrompt?.trim() || "Untitled story").slice(0, 200)}
              {(deleteTarget.storyPrompt?.length ?? 0) > 200 ? "…" : ""}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleteMutation.isPending}
              onClick={() => setDeleteId(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="gap-2"
              disabled={deleteMutation.isPending || !deleteId}
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  Streamed from your Bunny CDN URL. Use the player controls below;
                  your browser may offer fullscreen from the control bar.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center justify-center bg-black px-2 py-3">
                <video
                  key={playback.url}
                  src={playback.url}
                  controls
                  playsInline
                  preload="metadata"
                  className={
                    playback.aspectRatio === "9:16"
                      ? "max-h-[min(78vh,820px)] w-auto max-w-full object-contain"
                      : "aspect-video max-h-[min(72vh,640px)] w-full max-w-full object-contain"
                  }
                />
              </div>
              <DialogFooter className="flex-row flex-wrap justify-end gap-2 border-t border-border/60 bg-muted/30 px-4 py-3">
                <a
                  href={playback.url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "inline-flex gap-2"
                  )}
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
                <Link
                  href={`/stories/create?edit=${playback.id}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "inline-flex gap-2"
                  )}
                >
                  <Pencil className="h-4 w-4" />
                  Edit story
                </Link>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {projectsLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading stories…</span>
        </div>
      ) : projectsError ? (
        <Card className="border-destructive/50">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Could not load your stories. Refresh the page or try again later.
          </CardContent>
        </Card>
      ) : projects.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const status = storyStatusLabel(p);
            const StatusIcon = status.icon;
            const storyAspect = normalizeStoryVideoAspectRatio(p.aspectRatio);
            const title =
              (p.storyPrompt?.trim() || "Untitled story").slice(0, 120) +
              (p.storyPrompt && p.storyPrompt.length > 120 ? "…" : "");
            return (
              <li key={p.id}>
                <Card className="h-full overflow-hidden transition-colors hover:bg-muted/40">
                  <div
                    className={`relative bg-muted ${
                      storyAspect === "9:16"
                        ? "aspect-[9/16] max-h-64 mx-auto"
                        : "aspect-video"
                    }`}
                  >
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="absolute top-2 right-2 z-10 h-8 w-8 border border-border/80 bg-background/90 shadow-sm hover:bg-destructive hover:text-destructive-foreground"
                      aria-label="Delete story"
                      onClick={() => setDeleteId(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    {p.finalVideoUrl ? (
                      <button
                        type="button"
                        className="absolute inset-0 block cursor-pointer border-0 bg-transparent p-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
                        aria-label={`Play video: ${title}`}
                        onClick={() =>
                          setPlayback({
                            id: p.id,
                            url: p.finalVideoUrl!,
                            title:
                              p.storyPrompt?.trim() || "Untitled story",
                            aspectRatio: storyAspect,
                          })
                        }
                      >
                        {p.previewImageUrl ? (
                          <img
                            src={p.previewImageUrl}
                            alt=""
                            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <video
                            src={storyVideoThumbnailSrc(p.finalVideoUrl)}
                            muted
                            playsInline
                            preload="metadata"
                            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                            aria-hidden
                          />
                        )}
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
                          <div className="rounded-full bg-background/90 p-3 shadow-md">
                            <Play className="h-6 w-6 text-foreground" aria-hidden />
                          </div>
                        </div>
                      </button>
                    ) : (
                      <Link
                        href={`/stories/create?edit=${p.id}`}
                        className="absolute inset-0 block"
                      >
                        {p.previewImageUrl ? (
                          <img
                            src={p.previewImageUrl}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                            <Film className="h-12 w-12 opacity-40" aria-hidden />
                          </div>
                        )}
                      </Link>
                    )}
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/stories/create?edit=${p.id}`}
                        className="min-w-0 flex-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <h3 className="font-medium text-sm leading-snug line-clamp-2 hover:underline">
                          {title}
                        </h3>
                      </Link>
                      <Badge
                        variant={status.variant}
                        className="shrink-0 gap-1 text-xs"
                      >
                        <StatusIcon
                          className={`w-3 h-3 ${status.label === "Generating" ? "animate-spin" : ""}`}
                        />
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(p.createdAt).toLocaleString()}
                      </span>
                      <span>{p.storyDuration}s</span>
                      <span>{storyAspect}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      {p.finalVideoUrl ? (
                        <>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                            onClick={() =>
                              setPlayback({
                                id: p.id,
                                url: p.finalVideoUrl!,
                                title:
                                  p.storyPrompt?.trim() || "Untitled story",
                                aspectRatio: storyAspect,
                              })
                            }
                          >
                            <Play className="h-3 w-3" />
                            Play video
                          </button>
                          <span className="text-muted-foreground">·</span>
                          <Link
                            href={`/stories/create?edit=${p.id}`}
                            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </Link>
                        </>
                      ) : (
                        <Link
                          href={`/stories/create?edit=${p.id}`}
                          className="text-muted-foreground hover:text-foreground hover:underline"
                        >
                          Step {Math.min(p.currentStep, 3)} of 3 · Continue editing
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Film className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-1">
              {hasCharacters ? "No stories yet" : "Create characters first"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              {hasCharacters
                ? "Create your first AI story video using your characters"
                : "You need at least one character before you can create a story"}
            </p>
            <Link href={hasCharacters ? "/stories/create" : "/characters/create"}>
              <Button className="gap-2">
                <PlusCircle className="w-4 h-4" />
                {hasCharacters ? "Create Your First Story" : "Create Character"}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
