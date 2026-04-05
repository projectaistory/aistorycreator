"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Film, Play, Clock, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import type { Character } from "@/types";

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
}

export default function StoriesPage() {
  const { data: charData } = useQuery({
    queryKey: ["characters"],
    queryFn: () => apiRequest<{ characters: Character[] }>("/api/characters"),
  });

  const hasCharacters = (charData?.characters?.length || 0) > 0;

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
    </div>
  );
}
