# Standalone AI Story Generator — Porting Guide

This document describes how **NeonVideo** combines the **Character Creator** flow with **Story Video** (script → TTS → scene images → per-scene video → merge → captions) so you can reproduce a **standalone AI story app** in a separate project.

**Companion doc:** For character generation, uploads, styles, WaveSpeed text-to-image / i2i / camera-angle details, see [`standalone-character-creator-porting-guide.md`](./standalone-character-creator-porting-guide.md). This guide assumes you either embed that tool first or call the same APIs.

---

## 1. Intended product flow (standalone)

1. **Character phase** — User creates or selects one or more characters (`name`, `imageUrl`, optional `prompt`). At least one **publicly fetchable** `imageUrl` is strongly recommended so scene art stays on-model (see §6.3).
2. **Story setup** — User enters a **story prompt**, **target duration** (30–300 s), optional **narrator** + **narrator voice**, **aspect ratio** (`16:9` or `3:4`), and assigns **per-character voices** (optional but improves dialogue).
3. **Script** — Backend calls **OpenAI** to produce a fixed number of **5 s scenes** (duration ÷ 5).
4. **Review** — User may edit the script locally, then **`update-script`** persists changes.
5. **Assets** — **Credits** are charged; server generates **TTS** per line (WaveSpeed Inworld) and **scene images** (reference image or text-only).
6. **Video** — Client polls until assets are ready, then **`generate-video`** runs **lipsync** (InfiniteTalk) or **silent + merge** (Seedance + ffmpeg) per scene, merges segments, adds captions, uploads final.

---

## 2. Primary source files in this repo

| Role | Path |
|------|------|
| Story UI (3 steps + polling) | `client/src/pages/create-story-video.tsx` |
| App route (protected) | `client/src/App.tsx` → `/create/story-video` |
| Story HTTP routes | `server/routes.ts` (section “STORY VIDEO ENDPOINTS”) |
| Script generation (OpenAI) | `server/services/openai.ts` → `generateStoryScript` |
| Scene images (WaveSpeed) | `server/services/fal.ts` → `generateSceneImages`, `generateSceneImagesFromText`, `generateSingleSceneImage` |
| TTS + video segments | `server/services/wavespeed.ts` → `generateStoryAudio`, `generateVideoSegment` |
| Voice list + preview URLs | `server/services/storyVoices.ts` → `listStoryVoiceOptions` |
| Shared constants + types | `shared/storyConstants.ts` |
| Character picker modal (library) | `client/src/components/modals/character-library-modal.tsx` |

---

## 3. Authentication

Same as the character creator: JWT in **`localStorage` key `auth_token`**, header **`Authorization: Bearer <token>`**, and `credentials: "include"` where applicable (`client/src/lib/queryClient.ts`).

| Endpoint | Auth |
|----------|------|
| `GET /api/story-voices` | **None** (public) |
| `GET /api/characters/styles` | **None** (public) |
| `GET /api/characters` | **Required** (saved library for picker) |
| `POST /api/story-video/generate-script` | **Required** |
| `POST /api/story-video/:id/update-script` | **Required** |
| `POST /api/story-video/:id/generate-assets` | **Required** |
| `POST /api/story-video/:id/generate-video` | **Required** |
| `POST /api/story-video/:id/regenerate-scene/:sceneIndex` | **Required** |
| `GET /api/projects/:id` | **Required** (poll project + story fields) |
| `GET /api/projects/:id/logs` | **Required** (progress UI) |
| All character creator endpoints | See character porting guide |

---

## 4. Shared types and limits (`shared/storyConstants.ts`)

```ts
interface StoryCharacter {
  name: string;
  imageUrl: string;
  voiceId: string | null;
  prompt: string;
}

interface StoryScene {
  id: number;
  character: string;       // "Narrator" or exact character name
  audio: string;           // line for TTS (~8–20 words per 5s clip)
  scene_description: string;
}

const STORY_DURATION_MIN = 30;
const STORY_DURATION_MAX = 300;
const STORY_MAX_CHARACTERS = 3;
const STORY_DEFAULT_NARRATOR_VOICE = "Alex";

// Credits: ceil(durationSeconds / 30) * STORY_VIDEO_CREDITS_PER_30_SECONDS (2000)
function getStoryVideoGenerationCredits(durationSeconds: number): number;
```

**UI rule:** The create page caps characters at **`STORY_MAX_CHARACTERS` (3)**. The server **`generate-script`** handler also uses **`characters.slice(0, 3)`** — only the first three entries affect script generation.

---

## 5. HTTP API reference (story video)

Base URL = your API origin (e.g. dev server or production).

### 5.1 `GET /api/story-voices`

Public. Returns voices for dropdowns + preview playback.

**Response**

```json
{
  "voices": [
    { "id": "Alex", "previewUrl": "https://neonvideo.b-cdn.net/voices/Alex.mp3" }
  ]
}
```

**Implementation notes**

- Default preview base: `https://neonvideo.b-cdn.net/voices` (override with env **`STORY_VOICE_CDN_BASE`**).
- If `public/voices/*.mp3` exists, the server lists **only those filenames** (id = basename without `.mp3`); otherwise it lists **`STORY_INWORLD_VOICE_IDS`** from `shared/storyConstants.ts`.

---

### 5.2 `POST /api/story-video/generate-script`

**Body (JSON)**

```json
{
  "storyPrompt": "string (required)",
  "duration": 60,
  "narrator": true,
  "narratorVoice": "Alex",
  "characters": [
    {
      "name": "Maya",
      "imageUrl": "https://...",
      "voiceId": "Olivia",
      "prompt": "optional, stored on project"
    }
  ],
  "aspectRatio": "16:9"
}
```

- **`duration`**: clamped server-side to **30–300** (default 60 if invalid).
- **`aspectRatio`**: stored as **`16:9`** or **`3:4`** (anything else becomes `3:4`).
- **`narratorVoice`**: used when `narrator` is true; aligns with Inworld voice ids.

**Behavior**

- Calls **`generateStoryScript`** (`gpt-4o-mini`, JSON object with `scenes` array). Scene count = **`Math.floor(duration / 5)`** (each scene is one 5 s clip).
- Creates a **`projects`** row with **`projectType: "story_video"`**, stores `storyPrompt`, `storyDuration`, `storyNarrator`, `storyNarratorVoice`, `storyCharacters`, `storyScript`, `storyScenePrompts` (from `scene_description`), `aspectRatio`, `currentStep: 2`.
- Adds a generation log step **`story_script`** (completed).

**Success**

```json
{
  "projectId": "<uuid>",
  "script": [ { "id": 1, "character": "Narrator", "audio": "...", "scene_description": "..." } ]
}
```

---

### 5.3 `POST /api/story-video/:id/update-script`

**Body**

```json
{
  "script": [ /* StoryScene[] */ ]
}
```

Updates `storyScript` and **`storyScenePrompts`** = `script.map(s => s.scene_description)`.

**Errors:** `404` if not owner; `400` if `script` is not an array.

---

### 5.4 `POST /api/story-video/:id/generate-assets`

**When:** After the user confirms the script (step 2 → 3 in the UI).

**Credits**

- Computes cost with **`getStoryVideoGenerationCredits(project.storyDuration)`**.
- **`402`** if insufficient credits:

```json
{
  "error": "Insufficient credits...",
  "creditsRequired": 4000,
  "creditsRemaining": 100,
  "storyDuration": 60
}
```

**Concurrency**

- **`409`** if `generationStatus === "generating"` (assets already running).

**Immediate HTTP response** (pipeline continues **asynchronously**)

```json
{
  "status": "generating",
  "projectId": "<id>",
  "creditsCharged": 4000,
  "storyDuration": 60
}
```

**Async work (server)**

1. Sets `generationStatus: "generating"`, `generationStartedAt`.
2. **Audio** — For each scene, `generateStoryAudio(scene.audio, voiceId)`:
   - Voice resolution: narrator uses `storyNarratorVoice`; named characters use `voiceMap[characterName]` or fall back to **`STORY_DEFAULT_NARRATOR_VOICE`**.
   - Log steps: **`story_audio`** (started → completed).
3. **Images** — If **any** `storyCharacters` has `imageUrl`, uses **`generateSceneImages(descriptions, refImage, aspectRatio)`** where **`refImage` is the first character with a non-empty `imageUrl`**. Otherwise **`generateSceneImagesFromText`**.
   - Log steps: **`story_images`** (started → completed).
4. On success: `storyAudioUrls`, `storySceneImages`, `generationStatus: "completed"`, `currentStep: 3`.
5. On failure: `generationStatus: "failed"`, log **`story_assets_error`**.

The UI polls **`GET /api/projects/:id`** until `storySceneImages` is populated and `generationStatus === "completed"` (or failed).

---

### 5.5 `POST /api/story-video/:id/generate-video`

**Preconditions**

- `storySceneImages.length > 0` and at least one non-empty `storyAudioUrls` entry.
- **`409`** if video generation already marked generating.

**Response**

```json
{
  "status": "generating",
  "generationId": "<nanoid>",
  "projectId": "<id>"
}
```

**Async pipeline**

1. For each scene index `i`, parallel work:
   - If **`storyScript[i].character === "Narrator"`**:
     - **`generateVideoSegment`** with model **`seedance`**, **empty audio** → silent clip, then **`mergeVideos`** with scene audio via **ffmpegapi** (dimensions `1280x720` or `720x960` from aspect).
   - Else:
     - **`generateVideoSegment`** with model **`infinitetalk`**, **`sceneAudio`**, image, prompt (5 s segment, **`videoQuality`** from project default **`quick`**).
   - Optional Bunny upload per segment (`scenes` bucket).
2. **`mergeVideos`** all segment URLs → one file; optional Bunny `final` upload.
3. **`addTikTokCaptions`** (`server/services/ffmpegCaptions`) — phrase-style captions; on failure, logs warning and keeps uncaptioned video.
4. Sets `finalVideoUrl`, `isCompleted: true`, `generationStatus: "completed"`, `currentStep: 5`.
5. Log progression includes: **`story_video_start`**, **`story_video_segment`**, **`story_video_segments`**, **`story_video_merge`**, **`story_video_upload`**, **`story_video_captions`**, **`story_video_complete`** (and **`story_video_error`** on failure).

**Client pattern** (`create-story-video.tsx`): When step 3 is active and project shows **`generationStatus === "completed"`** with scene images but **no** `finalVideoUrl`, the client **auto-invokes** `generate-video` once (guarded by a ref).

---

### 5.6 `POST /api/story-video/:id/regenerate-scene/:sceneIndex`

**Body (optional)**

```json
{ "prompt": "override scene_description; else uses stored storyScenePrompts[index]" }
```

Regenerates one image (same reference-image vs text-only rule as asset generation), updates `storySceneImages` and `storyScenePrompts` at that index.

**Note:** This route does **not** re-charge the full story credits in the current implementation; use for iteration after the initial asset pass.

---

### 5.7 Polling: `GET /api/projects/:id`

Used to hydrate:

- `storyPrompt`, `storyDuration`, `storyNarrator`, `storyNarratorVoice`, `storyCharacters`, `storyScript`, `storySceneImages`, `storyAudioUrls`, `finalVideoUrl`, `isCompleted`, `generationStatus`, `aspectRatio`, `videoQuality`, etc.

**Edit mode:** The UI supports **`?edit=<projectId>`** and loads the same endpoint to restore state.

---

### 5.8 Polling: `GET /api/projects/:id/logs`

Returns generation logs for progress labels. The create page maps log **`step`** values to user-facing milestones (e.g. `story_audio`, `story_images`, `story_video_merge`, …).

---

## 6. Third-party and internal services (replicate without this backend)

### 6.1 OpenAI — story script

- **Function:** `generateStoryScript` in `server/services/openai.ts`.
- **Model:** `gpt-4o-mini`.
- **Output:** JSON object with key **`scenes`**: array of `{ id, character, audio, scene_description }` (ids renumbered 1..N server-side).
- **Env:** `OPENAI_API_KEY` (and whatever your `openai` client uses in that file).

### 6.2 WaveSpeed — story TTS

- **URL:** `POST https://api.wavespeed.ai/api/v3/inworld/inworld-1.5-mini/text-to-speech`
- **Body:** `{ "text", "voice_id", "speaking_rate": 1, "temperature": 1 }`
- **Poll:** `GET https://api.wavespeed.ai/api/v3/predictions/{id}/result` every **3 s**, up to **120** attempts.
- **Env:** `WAVESPEED_API_KEY`

### 6.3 WaveSpeed — scene images (with character)

**Primary path:** `generateSceneImages` → **`generateSceneImagesSequential`**

- **URL:** `POST https://api.wavespeed.ai/api/v3/bytedance/seedream-v4.5/edit-sequential`
- **Body (conceptually):** reference **`images: [publicCharacterUrl]`**, **`max_images`**, **`prompt`** (batched sequential text), **`size`** from aspect (same mapping as character guide Seedream i2i sizes — see `seedreamImageToImageSizeForAspectRatio` in `server/services/fal.ts`).
- **Poll:** `GET .../predictions/{id}/result` every **5 s** (long timeout for batches).
- **Batching:** Up to **12** images per API call; longer stories run multiple batches.

**Important:** The reference image must be a **public HTTP(S) URL**. This codebase uses **`ensurePublicImageUrl`** for `/objects/...` paths. Your standalone app should mirror that for any storage you use.

**Consistency quirk:** The server picks **the first** saved character with `imageUrl` as the single reference for **all** scenes — not per-character references. For multi-character stories, the script and prompts rely on that one visual anchor.

### 6.4 WaveSpeed — scene images (no character image)

**Function:** `generateSceneImagesFromText`

- **URL:** `POST https://api.wavespeed.ai/api/v3/bytedance/seedream-v4/sequential`
- Builds a sequential prompt from all `scene_description` values; batches of up to **12**; polls same predictions endpoint.

### 6.5 WaveSpeed — video segments

**Function:** `generateVideoSegment` in `server/services/wavespeed.ts`

| Mode | Endpoint | Role |
|------|----------|------|
| **infinitetalk** | `POST https://api.wavespeed.ai/api/v3/wavespeed-ai/infinitetalk-fast` | Lipsync: **`audio`**, **`image`**, **`prompt`**, **`seed`** |
| **seedance** (quick) | `POST https://api.wavespeed.ai/api/v3/bytedance/seedance-v1.5-pro/image-to-video-fast` | Silent motion: **`image`**, **`prompt`**, **`duration`** (min 6 s for this path), **`aspect_ratio`**, **`generate_audio`: false**, etc. |

**Poll:** `GET .../predictions/{id}/result` every **10 s**, up to **60** attempts.

**Quality:** Story projects use **`videoQuality`** from DB; default **`quick`** (Seedance / InfiniteTalk as above). Premium/medium paths use **Alibaba Wan 2.5** image-to-video when `model === "seedance"` with non-quick quality (see `generateVideoSegmentInternal`).

### 6.6 ffmpeg merge + captions

- **`mergeVideos`** — provided by this codebase’s WaveSpeed/ffmpegapi integration (used to combine silent Seedance + narrator audio, and to concatenate segment MP4s).
- **`addTikTokCaptions`** — `server/services/ffmpegCaptions.ts` (Remotion-style caption pipeline). Story uses **`maxCharsPerLine: 50`**, **`maxLines: 1`**, subtitle style from project (defaults **`yellow-bg`**).

### 6.7 Optional: Bunny storage + Mux

If Bunny is configured, audio clips, segments, and final outputs may be re-uploaded to CDN. On completion, **`createMuxAssetForVideo`** may run for streaming — optional for a minimal standalone port.

---

## 7. Character phase integration

**Recommended standalone sequence**

1. Run the **standalone character creator** (or embedded `StandaloneCharacterCreator`) so the user ends with **`imageUrl`** (and optional **`POST /api/characters`** save).
2. **`GET /api/characters`** — populate a library / picker (`CharacterLibraryModal` pattern).
3. Map each selected row to **`StoryCharacter`**: set **`voiceId`** in the story UI (defaults to `null` → TTS falls back to default narrator voice for that line’s resolved speaker).

**Minimum viable story without library:** Accept a single generated image URL + name from step 1 and pass it as the only `characters[]` entry.

---

## 8. Credits and billing

- Charge (or gate) using the same formula as **`getStoryVideoGenerationCredits`**: **2000 credits per 30 seconds**, rounded up, duration clamped 30–300 s.
- **`generate-assets`** is where NeonVideo **deducts** credits today; **`generate-script`** does not charge in the current code.

---

## 9. Frontend dependencies (story page)

Same stack as the rest of the client: **React**, **TanStack Query**, **`apiRequest`**, **wouter** (`useLocation`), **lucide-react**, shadcn-style UI (`button`, `card`, `input`, `textarea`, `switch`, `slider`, `progress`, `select`), toasts, **`CharacterLibraryModal`**.

Progress UI depends on **`/api/projects/:id/logs`** + the step-completion helpers in `create-story-video.tsx`.

---

## 10. Checklist for a greenfield standalone app

1. **Auth** — JWT compatible with protected routes above.
2. **Character creator** — Implement or proxy per [`standalone-character-creator-porting-guide.md`](./standalone-character-creator-porting-guide.md); ensure **public URLs** for reference images used in Seedream.
3. **Voices** — Serve or proxy **`GET /api/story-voices`** (or hardcode ids + CDN preview URLs from `STORY_INWORLD_VOICE_IDS`).
4. **Script** — OpenAI `gpt-4o-mini` with the same scene-count and JSON constraints as `generateStoryScript`.
5. **Assets** — WaveSpeed TTS + Seedream sequential (with ref) or sequential text-only; persist ordered **`storyAudioUrls`** and **`storySceneImages`**.
6. **Video** — Per-scene InfiniteTalk vs Seedance+merge branch on **Narrator**; merge all segments; optional captions and CDN upload.
7. **UX** — Three steps + polling; handle **`402`**, **`409`**, **`generationStatus: "failed"`**; optional **`regenerate-scene`** for fixes.
8. **Credits** — Align pricing with **`getStoryVideoGenerationCredits`** if you mirror Neon’s model.

---

*Generated from repository state: `create-story-video.tsx`, `server/routes.ts` (story video block), `server/services/openai.ts` (`generateStoryScript`), `server/services/fal.ts` (scene image generation), `server/services/wavespeed.ts` (`generateStoryAudio`, `generateVideoSegment`), `server/services/storyVoices.ts`, `shared/storyConstants.ts`.*
