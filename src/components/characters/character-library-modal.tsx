"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Character, StoryCharacter } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  selected: StoryCharacter[];
  onSelect: (characters: StoryCharacter[]) => void;
  maxCharacters: number;
}

export function CharacterLibraryModal({
  open,
  onClose,
  selected,
  onSelect,
  maxCharacters,
}: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["characters"],
    queryFn: () => apiRequest<{ characters: Character[] }>("/api/characters"),
    enabled: open,
  });

  const characters = data?.characters || [];
  const selectedNames = new Set(selected.map((s) => s.name));

  function toggleCharacter(char: Character) {
    if (selectedNames.has(char.name)) {
      onSelect(selected.filter((s) => s.name !== char.name));
    } else if (selected.length < maxCharacters) {
      onSelect([
        ...selected,
        {
          name: char.name,
          imageUrl: char.imageUrl,
          voiceId: null,
          prompt: char.prompt,
        },
      ]);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Select Characters ({selected.length}/{maxCharacters})
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {isLoading ? (
            <div className="grid gap-3 grid-cols-3 p-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[3/4] bg-muted rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : characters.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No characters created yet. Create characters first.
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-3 p-1">
              {characters.map((char) => {
                const isSelected = selectedNames.has(char.name);
                const disabled = !isSelected && selected.length >= maxCharacters;
                return (
                  <button
                    key={char.id}
                    onClick={() => toggleCharacter(char)}
                    disabled={disabled}
                    className={cn(
                      "relative rounded-lg overflow-hidden border-2 transition-all text-left",
                      isSelected
                        ? "border-primary ring-2 ring-primary/30"
                        : disabled
                          ? "border-transparent opacity-40 cursor-not-allowed"
                          : "border-transparent hover:border-primary/40"
                    )}
                  >
                    <div className="aspect-[3/4] bg-muted relative">
                      {char.imageUrl ? (
                        <img
                          src={char.imageUrl}
                          alt={char.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <ImageIcon className="w-6 h-6 text-muted-foreground/40" />
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-4 h-4 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-sm font-medium truncate">{char.name}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
