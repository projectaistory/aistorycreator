"use client";

import Link from "next/link";
import { useAuth } from "@/lib/use-auth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Film,
  PlusCircle,
  UserPlus,
  Coins,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import type { Character } from "@/types";

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: charData } = useQuery({
    queryKey: ["characters"],
    queryFn: () => apiRequest<{ characters: Character[] }>("/api/characters"),
  });

  const characterCount = charData?.characters?.length || 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">
          Welcome back, {user?.name}
        </h1>
        <p className="text-muted-foreground mt-1">
          Create characters and bring your stories to life with AI
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Credits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-primary" />
              <span className="text-2xl font-bold">
                {user?.credits.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Characters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              <span className="text-2xl font-bold">{characterCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="w-3 h-3" />
              Ready to create
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="group hover:border-primary/40 transition-colors">
          <CardHeader>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-2">
              <UserPlus className="w-6 h-6 text-blue-400" />
            </div>
            <CardTitle>Create a Character</CardTitle>
            <p className="text-sm text-muted-foreground">
              Generate AI character images to use in your stories. Each character
              gets a unique look based on your description.
            </p>
          </CardHeader>
          <CardContent>
            <Link href="/characters/create">
              <Button className="gap-2 group-hover:gap-3 transition-all">
                Create Character
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="group hover:border-primary/40 transition-colors">
          <CardHeader>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-2">
              <Film className="w-6 h-6 text-purple-400" />
            </div>
            <CardTitle>Create a Story</CardTitle>
            <p className="text-sm text-muted-foreground">
              {characterCount === 0
                ? "Create at least one character first, then build an AI-powered story video."
                : "Use your characters to generate an AI story video with script, images, voice, and video."}
            </p>
          </CardHeader>
          <CardContent>
            <Link href={characterCount > 0 ? "/stories/create" : "/characters/create"}>
              <Button
                variant={characterCount > 0 ? "default" : "secondary"}
                className="gap-2 group-hover:gap-3 transition-all"
              >
                {characterCount > 0 ? (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    Create Story
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Create Character First
                  </>
                )}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
