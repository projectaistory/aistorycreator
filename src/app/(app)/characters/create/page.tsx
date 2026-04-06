"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Save, Loader2, ArrowLeft, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { CharacterStyle } from "@/types";

const THUMB_FALLBACK =
  "https://via.placeholder.com/150?text=No+Image";

export default function CreateCharacterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<CharacterStyle | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const { data: stylesRes, isLoading: stylesLoading } = useQuery({
    queryKey: ["character-styles"],
    queryFn: () =>
      apiRequest<{ styles: CharacterStyle[] }>("/api/characters/styles"),
  });

  const styles = stylesRes?.styles ?? [];

  useEffect(() => {
    if (styles.length && !selectedStyle) {
      const noStyle = styles.find((s) => s.style_name === "No style");
      setSelectedStyle(noStyle ?? styles[0] ?? null);
    }
  }, [styles, selectedStyle]);

  const generateMutation = useMutation({
    mutationFn: () => {
      if (!selectedStyle) throw new Error("Select a style");
      return apiRequest<{ imageUrl: string }>("/api/characters/generate-image", {
        method: "POST",
        body: JSON.stringify({
          prompt: prompt.trim(),
          style: selectedStyle.style_name,
          model: selectedStyle.model,
          promptEnhancer: selectedStyle.prompt_enhancer,
          aspectRatio: "3:4",
        }),
      });
    },
    onSuccess: (data) => {
      setGeneratedImage(data.imageUrl);
      toast.success("Character image generated!");
    },
    onError: (err: unknown) => {
      toast.error((err as Record<string, string>)?.error || "Generation failed");
    },
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/characters", {
        method: "POST",
        body: JSON.stringify({
          name,
          imageUrl: generatedImage,
          prompt,
          style: selectedStyle?.style_name ?? null,
        }),
      }),
    onSuccess: () => {
      toast.success("Character saved!");
      router.push("/characters");
    },
    onError: (err: unknown) => {
      toast.error((err as Record<string, string>)?.error || "Save failed");
    },
  });

  const canGenerate =
    prompt.trim().length > 10 && !!selectedStyle && !generateMutation.isPending;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/characters">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Create Character</h1>
          <p className="text-sm text-muted-foreground">
            Generate an AI character image for your stories
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Character Details</CardTitle>
            <CardDescription>Describe your character for AI generation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Character Name</Label>
              <Input
                id="name"
                placeholder="e.g. Maya, Captain Rex..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label>Art style</Label>
              <p className="text-xs text-muted-foreground">
                Thumbnails from NeonVideo CDN (see porting guide §4).
              </p>
              {stylesLoading ? (
                <div className="h-40 rounded-lg bg-muted animate-pulse" />
              ) : (
                <ScrollArea className="h-[220px] rounded-lg border border-border/50 p-2">
                  <div className="grid grid-cols-3 gap-2 pr-3">
                    {styles.map((s) => (
                      <button
                        key={s.style_name}
                        type="button"
                        onClick={() => setSelectedStyle(s)}
                        className={cn(
                          "rounded-lg border-2 overflow-hidden text-left transition-colors",
                          selectedStyle?.style_name === s.style_name
                            ? "border-primary ring-2 ring-primary/30"
                            : "border-transparent hover:border-border"
                        )}
                      >
                        <div className="aspect-square bg-muted relative">
                          <img
                            src={s.thumbnail_image}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              const el = e.currentTarget;
                              if (el.src !== THUMB_FALLBACK) el.src = THUMB_FALLBACK;
                            }}
                          />
                        </div>
                        <p className="text-[10px] leading-tight p-1.5 line-clamp-2">
                          {s.style_name}
                        </p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">Description</Label>
              <Textarea
                id="prompt"
                placeholder="Describe your character's appearance in detail (more than 10 characters)."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                className="bg-background/50 resize-none"
              />
            </div>

            <Button
              onClick={() => generateMutation.mutate()}
              disabled={!canGenerate}
              className="w-full gap-2"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Image
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preview</CardTitle>
            <CardDescription>Your generated character image</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="aspect-[3/4] rounded-xl border border-border/50 bg-muted/30 flex items-center justify-center overflow-hidden">
              {generatedImage ? (
                <img
                  src={generatedImage}
                  alt={name || "Generated character"}
                  className="w-full h-full object-cover"
                />
              ) : generateMutation.isPending ? (
                <div className="text-center space-y-3">
                  <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Generating your character...
                  </p>
                </div>
              ) : (
                <div className="text-center space-y-3 p-6">
                  <ImageIcon className="w-10 h-10 mx-auto text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    Enter a description and generate to see your character
                  </p>
                </div>
              )}
            </div>

            {generatedImage && (
              <div className="flex gap-2">
                <Button
                  onClick={() => generateMutation.mutate()}
                  variant="outline"
                  className="flex-1"
                  disabled={generateMutation.isPending}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Regenerate
                </Button>
                <Button
                  onClick={() => saveMutation.mutate()}
                  className="flex-1"
                  disabled={!name || saveMutation.isPending}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Character
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
