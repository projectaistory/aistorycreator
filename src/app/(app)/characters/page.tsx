"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Trash2, Users, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import type { Character } from "@/types";

export default function CharactersPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["characters"],
    queryFn: () => apiRequest<{ characters: Character[] }>("/api/characters"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/characters/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["characters"] });
      toast.success("Character deleted");
    },
  });

  const characters = data?.characters || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Character Library</h1>
          <p className="text-sm text-muted-foreground">
            Your AI-generated characters for story creation
          </p>
        </div>
        <Link href="/characters/create">
          <Button className="gap-2">
            <PlusCircle className="w-4 h-4" />
            Create Character
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="aspect-[3/4] bg-muted animate-pulse" />
              <CardContent className="p-3">
                <div className="h-4 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : characters.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-1">No characters yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              Create your first AI character to get started with story creation
            </p>
            <Link href="/characters/create">
              <Button className="gap-2">
                <PlusCircle className="w-4 h-4" />
                Create Your First Character
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {characters.map((char) => (
            <Card
              key={char.id}
              className="overflow-hidden group hover:border-primary/40 transition-colors"
            >
              <div className="aspect-[3/4] bg-muted relative overflow-hidden">
                {char.imageUrl ? (
                  <img
                    src={char.imageUrl}
                    alt={char.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => deleteMutation.mutate(char.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm truncate">{char.name}</h3>
                  {char.style && (
                    <Badge variant="secondary" className="text-xs ml-2 flex-shrink-0">
                      {char.style}
                    </Badge>
                  )}
                </div>
                {char.prompt && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {char.prompt}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
