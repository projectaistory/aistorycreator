export interface StoryCharacter {
  /** Saved library character id when chosen from the picker (stable identity). */
  id?: string;
  /** Speaker name in script/audio; uniquified when the same library name is picked twice. */
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
  /** Library character id for cast lines; null/omit for Narrator. */
  characterId?: string | null;
}

export interface Voice {
  id: string;
  previewUrl: string;
}

/** `GET /api/characters/styles` item — standalone-character-creator-porting-guide.md §3.1 */
export interface CharacterStyle {
  style_name: string;
  model: string;
  thumbnail_image: string;
  prompt_enhancer: string | null;
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

export type UserRole = "USER" | "ADMIN";

export interface UserPlanSummary {
  id: string;
  name: string;
  slug: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  credits: number;
  role: UserRole;
  planId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeSubscriptionStatus: string | null;
  stripePriceId: string | null;
  stripeCurrentPeriodEnd: string | null;
  plan: UserPlanSummary | null;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

/** Public plan row from `GET /api/plans` */
export interface BillingPlan {
  id: string;
  name: string;
  slug: string;
  features: unknown;
  monthlyPrice: number;
  yearlyPrice: number;
  monthlyPriceId: string | null;
  yearlyPriceId: string | null;
  includedCredits: number;
  createdAt: string;
  updatedAt: string;
}
