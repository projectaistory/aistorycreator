export interface StoryCharacter {
  name: string;
  imageUrl: string;
  voiceId: string | null;
  prompt: string;
}

export interface StoryScene {
  id: number;
  character: string;
  audio: string;
  scene_description: string;
}

export interface Voice {
  id: string;
  previewUrl: string;
}

export interface Character {
  id: string;
  userId: string;
  name: string;
  imageUrl: string;
  prompt: string;
  style: string | null;
  createdAt: string;
}

export interface Project {
  id: string;
  userId: string;
  projectType: string;
  storyPrompt: string | null;
  storyDuration: number;
  storyNarrator: boolean;
  storyNarratorVoice: string | null;
  storyCharacters: StoryCharacter[];
  storyScript: StoryScene[];
  storyScenePrompts: string[];
  storySceneImages: string[];
  storyAudioUrls: string[];
  aspectRatio: string;
  videoQuality: string;
  generationStatus: string | null;
  generationStartedAt: string | null;
  finalVideoUrl: string | null;
  isCompleted: boolean;
  currentStep: number;
  createdAt: string;
}

export interface GenerationLog {
  id: string;
  projectId: string;
  step: string;
  status: string;
  message: string | null;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  credits: number;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
