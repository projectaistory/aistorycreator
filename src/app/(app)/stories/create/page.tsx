"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Users,
  Sparkles,
  Play,
  Pause,
  RefreshCw,
  Film,
  Mic,
  ImageIcon,
  Check,
  X,
  Download,
  Edit3,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { CharacterLibraryModal } from "@/components/characters/character-library-modal";
import {
  STORY_DURATION_MIN,
  STORY_DURATION_MAX,
  STORY_MAX_CHARACTERS,
  getStoryVideoGenerationCredits,
} from "@/lib/constants";
import type { StoryCharacter, StoryScene, Voice, Project, GenerationLog } from "@/types";
import Link from "next/link";

export default function CreateStoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  // Step tracking
  const [step, setStep] = useState(1);

  // Step 1: Story setup
  const [storyPrompt, setStoryPrompt] = useState("");
  const [duration, setDuration] = useState(60);
  const [narrator, setNarrator] = useState(true);
  const [narratorVoice, setNarratorVoice] = useState("Alex");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [characters, setCharacters] = useState<StoryCharacter[]>([]);
  const [showCharPicker, setShowCharPicker] = useState(false);

  // Step 2: Script review
  const [projectId, setProjectId] = useState<string | null>(editId);
  const [script, setScript] = useState<StoryScene[]>([]);
  const [editingScene, setEditingScene] = useState<number | null>(null);

  // Step 3: Generation
  const [generationStarted, setGenerationStarted] = useState(false);
  const videoTriggeredRef = useRef(false);

  // Voice previews
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: voicesData } = useQuery({
    queryKey: ["story-voices"],
    queryFn: () => apiRequest<{ voices: Voice[] }>("/api/story-voices"),
  });
  const voices = voicesData?.voices || [];

  // Polling for project status
  const { data: project, refetch: refetchProject } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => apiRequest<Project>(`/api/projects/${projectId}`),
    enabled: !!projectId && step >= 3,
    refetchInterval: step >= 3 && generationStarted ? 3000 : false,
  });

  const { data: logsData } = useQuery({
    queryKey: ["project-logs", projectId],
    queryFn: () =>
      apiRequest<{ logs: GenerationLog[] }>(`/api/projects/${projectId}/logs`),
    enabled: !!projectId && step >= 3 && generationStarted,
    refetchInterval: generationStarted ? 3000 : false,
  });

  // Load project for edit mode
  useEffect(() => {
    if (editId && !script.length) {
      apiRequest<Project>(`/api/projects/${editId}`).then((p) => {
        setStoryPrompt(p.storyPrompt || "");
        setDuration(p.storyDuration);
        setNarrator(p.storyNarrator);
        setNarratorVoice(p.storyNarratorVoice || "Alex");
        setAspectRatio(p.aspectRatio);
        setCharacters(p.storyCharacters || []);
        setScript((p.storyScript as StoryScene[]) || []);
        setStep(p.currentStep || 2);
      });
    }
  }, [editId, script.length]);

  // Auto-trigger video generation
  useEffect(() => {
    if (
      project &&
      step === 3 &&
      project.generationStatus === "completed" &&
      (project.storySceneImages as string[])?.length > 0 &&
      !project.finalVideoUrl &&
      !videoTriggeredRef.current
    ) {
      videoTriggeredRef.current = true;
      generateVideoMutation.mutate();
    }
  }, [project, step]);

  // Step 1: Generate script
  const generateScriptMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ projectId: string; script: StoryScene[] }>(
        "/api/story-video/generate-script",
        {
          method: "POST",
          body: JSON.stringify({
            storyPrompt,
            duration,
            narrator,
            narratorVoice,
            characters,
            aspectRatio,
          }),
        }
      ),
    onSuccess: (data) => {
      setProjectId(data.projectId);
      setScript(data.script);
      setStep(2);
      toast.success("Script generated!");
    },
    onError: (err: unknown) => {
      toast.error((err as Record<string, string>)?.error || "Script generation failed");
    },
  });

  // Step 2: Update script
  const updateScriptMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/story-video/${projectId}/update-script`, {
        method: "POST",
        body: JSON.stringify({ script }),
      }),
    onSuccess: () => toast.success("Script saved"),
    onError: () => toast.error("Failed to save script"),
  });

  // Step 3: Generate assets
  const generateAssetsMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/story-video/${projectId}/generate-assets`, {
        method: "POST",
      }),
    onSuccess: () => {
      setGenerationStarted(true);
      setStep(3);
      toast.success("Asset generation started!");
    },
    onError: (err: unknown) => {
      const e = err as Record<string, unknown>;
      if (e?.status === 402) {
        toast.error(
          `Insufficient credits. Need ${e.creditsRequired}, have ${e.creditsRemaining}`
        );
      } else if (e?.status === 409) {
        toast.error("Assets are already being generated");
      } else {
        toast.error((e?.error as string) || "Failed to start generation");
      }
    },
  });

  // Step 3: Generate video
  const generateVideoMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/story-video/${projectId}/generate-video`, {
        method: "POST",
      }),
    onError: () => {
      videoTriggeredRef.current = false;
    },
  });

  // Regenerate scene
  const regenerateSceneMutation = useMutation({
    mutationFn: (sceneIndex: number) =>
      apiRequest<{ imageUrl: string }>(
        `/api/story-video/${projectId}/regenerate-scene/${sceneIndex}`,
        { method: "POST" }
      ),
    onSuccess: () => {
      refetchProject();
      toast.success("Scene regenerated!");
    },
    onError: () => toast.error("Failed to regenerate scene"),
  });

  const previewVoice = useCallback((voiceId: string, previewUrl: string) => {
    if (playingVoice === voiceId) {
      audioRef.current?.pause();
      setPlayingVoice(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(previewUrl);
    audio.onended = () => setPlayingVoice(null);
    audio.play();
    audioRef.current = audio;
    setPlayingVoice(voiceId);
  }, [playingVoice]);

  // Progress computation from logs
  const logs = logsData?.logs || [];
  const progressSteps = [
    { key: "story_audio", label: "Generating voices" },
    { key: "story_images", label: "Creating scene images" },
    { key: "story_video_start", label: "Starting video" },
    { key: "story_video_segments", label: "Creating video segments" },
    { key: "story_video_complete", label: "Finalizing" },
  ];

  function getProgress() {
    const completed = progressSteps.filter((s) =>
      logs.some((l) => l.step === s.key && l.status === "completed")
    ).length;
    return Math.round((completed / progressSteps.length) * 100);
  }

  function getCurrentPhase() {
    for (let i = progressSteps.length - 1; i >= 0; i--) {
      const match = logs.find((l) => l.step === progressSteps[i].key);
      if (match) {
        return match.status === "completed"
          ? i < progressSteps.length - 1
            ? progressSteps[i + 1].label
            : "Complete!"
          : progressSteps[i].label;
      }
    }
    return "Starting...";
  }

  const credits = getStoryVideoGenerationCredits(duration);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/stories">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Create Story Video</h1>
          <p className="text-sm text-muted-foreground">
            Step {step} of 3
          </p>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`flex-1 h-1.5 rounded-full transition-colors ${
              s <= step ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* ═══════ STEP 1: Story Setup ═══════ */}
      {step === 1 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Story Setup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Story Prompt</Label>
                <Textarea
                  placeholder="Describe your story... e.g. 'An epic tale of a warrior princess who discovers a hidden dragon sanctuary in the mountains'"
                  value={storyPrompt}
                  onChange={(e) => setStoryPrompt(e.target.value)}
                  rows={4}
                  className="bg-background/50 resize-none"
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <Label>
                    Duration: {duration}s ({Math.floor(duration / 5)} scenes)
                  </Label>
                  <Slider
                    value={[duration]}
                    onValueChange={(v) => setDuration(Array.isArray(v) ? v[0] : v)}
                    min={STORY_DURATION_MIN}
                    max={STORY_DURATION_MAX}
                    step={5}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{STORY_DURATION_MIN}s</span>
                    <span>{STORY_DURATION_MAX}s</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Aspect Ratio</Label>
                  <Select value={aspectRatio} onValueChange={(v) => v && setAspectRatio(v)}>
                    <SelectTrigger className="bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                      <SelectItem value="3:4">3:4 (Portrait)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
                <div>
                  <Label>Narrator</Label>
                  <p className="text-xs text-muted-foreground">
                    Include a narrator for scene transitions
                  </p>
                </div>
                <Switch checked={narrator} onCheckedChange={setNarrator} />
              </div>

              {narrator && (
                <div className="space-y-2">
                  <Label>Narrator Voice</Label>
                  <div className="flex gap-2">
                    <Select value={narratorVoice} onValueChange={(v) => v && setNarratorVoice(v)}>
                      <SelectTrigger className="bg-background/50 flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {voices.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {voices.find((v) => v.id === narratorVoice) && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          previewVoice(
                            narratorVoice,
                            voices.find((v) => v.id === narratorVoice)!.previewUrl
                          )
                        }
                      >
                        {playingVoice === narratorVoice ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Characters */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  Characters ({characters.length}/{STORY_MAX_CHARACTERS})
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCharPicker(true)}
                >
                  Select Characters
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {characters.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Select characters from your library</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {characters.map((char, i) => (
                    <div
                      key={char.name}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50"
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        {char.imageUrl ? (
                          <img
                            src={char.imageUrl}
                            alt={char.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <ImageIcon className="w-4 h-4 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{char.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={char.voiceId || ""}
                          onValueChange={(v: string | null) => {
                            const updated = [...characters];
                            updated[i] = { ...char, voiceId: v || null };
                            setCharacters(updated);
                          }}
                        >
                          <SelectTrigger className="w-32 bg-background/50 h-8 text-xs">
                            <SelectValue placeholder="Voice..." />
                          </SelectTrigger>
                          <SelectContent>
                            {voices.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            setCharacters(characters.filter((_, j) => j !== i))
                          }
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Estimated cost: <Badge variant="secondary">{credits.toLocaleString()} credits</Badge>
            </div>
            <Button
              onClick={() => generateScriptMutation.mutate()}
              disabled={
                !storyPrompt ||
                characters.length === 0 ||
                generateScriptMutation.isPending
              }
              className="gap-2"
            >
              {generateScriptMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Script...
                </>
              ) : (
                <>
                  Generate Script
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>

          <CharacterLibraryModal
            open={showCharPicker}
            onClose={() => setShowCharPicker(false)}
            selected={characters}
            onSelect={setCharacters}
            maxCharacters={STORY_MAX_CHARACTERS}
          />
        </div>
      )}

      {/* ═══════ STEP 2: Script Review ═══════ */}
      {step === 2 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-primary" />
                Review & Edit Script
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {script.map((scene, i) => (
                <div
                  key={scene.id}
                  className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Scene {scene.id}
                      </Badge>
                      <Badge
                        variant={
                          scene.character === "Narrator" ? "outline" : "default"
                        }
                        className="text-xs"
                      >
                        {scene.character}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setEditingScene(editingScene === i ? null : i)
                      }
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1" />
                      {editingScene === i ? "Done" : "Edit"}
                    </Button>
                  </div>

                  {editingScene === i ? (
                    <div className="space-y-2">
                      <Label className="text-xs">Dialogue</Label>
                      <Textarea
                        value={scene.audio}
                        onChange={(e) => {
                          const updated = [...script];
                          updated[i] = { ...scene, audio: e.target.value };
                          setScript(updated);
                        }}
                        rows={2}
                        className="bg-background/50 text-sm resize-none"
                      />
                      <Label className="text-xs">Scene Description</Label>
                      <Textarea
                        value={scene.scene_description}
                        onChange={(e) => {
                          const updated = [...script];
                          updated[i] = {
                            ...scene,
                            scene_description: e.target.value,
                          };
                          setScript(updated);
                        }}
                        rows={3}
                        className="bg-background/50 text-sm resize-none"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-2">
                        <Mic className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <p className="text-sm">{scene.audio}</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <ImageIcon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-muted-foreground">
                          {scene.scene_description}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => updateScriptMutation.mutate()}
                disabled={updateScriptMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
              <Button
                onClick={() => {
                  updateScriptMutation.mutate();
                  generateAssetsMutation.mutate();
                }}
                disabled={generateAssetsMutation.isPending}
                className="gap-2"
              >
                {generateAssetsMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    Generate Assets
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ STEP 3: Generation & Video ═══════ */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Video player (when complete) */}
          {project?.finalVideoUrl && (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="aspect-video bg-black">
                  <video
                    src={project.finalVideoUrl}
                    controls
                    className="w-full h-full"
                  />
                </div>
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-400" />
                    <span className="font-medium">Story video complete!</span>
                  </div>
                  <a
                    href={project.finalVideoUrl}
                    download
                    target="_blank"
                    rel="noopener"
                  >
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="w-4 h-4" />
                      Download
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Progress */}
          {!project?.finalVideoUrl && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Film className="w-5 h-5 text-primary" />
                  Generating Story
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {getCurrentPhase()}
                    </span>
                    <span className="font-medium">{getProgress()}%</span>
                  </div>
                  <Progress value={getProgress()} className="h-2" />
                </div>

                <div className="space-y-2">
                  {progressSteps.map((ps) => {
                    const log = logs.find((l) => l.step === ps.key);
                    const isComplete = log?.status === "completed";
                    const isActive = log?.status === "started";
                    return (
                      <div
                        key={ps.key}
                        className="flex items-center gap-3 text-sm"
                      >
                        {isComplete ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : isActive ? (
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-muted-foreground/30" />
                        )}
                        <span
                          className={
                            isComplete
                              ? "text-foreground"
                              : isActive
                                ? "text-primary"
                                : "text-muted-foreground"
                          }
                        >
                          {ps.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {project?.generationStatus === "failed" && (
                  <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                    Generation failed. Please try again.
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-4"
                      onClick={() => generateAssetsMutation.mutate()}
                    >
                      Retry
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Scene images preview */}
          {(project?.storySceneImages as string[])?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Scene Images</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {(project!.storySceneImages as string[]).map(
                    (img: string, i: number) => (
                      <div key={i} className="relative group">
                        <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                          <img
                            src={img}
                            alt={`Scene ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="gap-1"
                            onClick={() => regenerateSceneMutation.mutate(i)}
                            disabled={regenerateSceneMutation.isPending}
                          >
                            <RefreshCw className="w-3 h-3" />
                            Regen
                          </Button>
                        </div>
                        <Badge
                          variant="secondary"
                          className="absolute top-1 left-1 text-xs"
                        >
                          {i + 1}
                        </Badge>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => router.push("/stories")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              My Stories
            </Button>
            {project?.finalVideoUrl && (
              <Button onClick={() => router.push("/stories/create")}>
                Create Another Story
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
