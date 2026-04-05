"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Save, Loader2, ArrowLeft, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

const STYLES = [
  { value: "realistic", label: "Realistic" },
  { value: "anime", label: "Anime" },
  { value: "3d-render", label: "3D Render" },
  { value: "cartoon", label: "Cartoon" },
  { value: "fantasy", label: "Fantasy Art" },
  { value: "watercolor", label: "Watercolor" },
  { value: "pixel-art", label: "Pixel Art" },
  { value: "cinematic", label: "Cinematic" },
];

export default function CreateCharacterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("realistic");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const generateMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ imageUrl: string }>("/api/characters/generate-image", {
        method: "POST",
        body: JSON.stringify({ prompt, style }),
      }),
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
          style,
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
              <Label htmlFor="style">Art Style</Label>
              <Select value={style} onValueChange={(v) => v && setStyle(v)}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STYLES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">Description</Label>
              <Textarea
                id="prompt"
                placeholder="Describe your character's appearance in detail. e.g. 'A young woman with silver hair and violet eyes, wearing a dark leather jacket, determined expression'"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                className="bg-background/50 resize-none"
              />
            </div>

            <Button
              onClick={() => generateMutation.mutate()}
              disabled={!prompt || generateMutation.isPending}
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
