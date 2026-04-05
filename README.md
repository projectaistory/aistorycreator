# AI Story Creator

A full-stack AI-powered story video creation platform. Create custom characters using AI image generation, then use them to produce scripted story videos with voice acting, scene images, and video segments.

## Tech Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** JWT (bcrypt password hashing)
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **AI Services:** OpenAI (script), WaveSpeed (TTS, images, video)

## Prerequisites

- Node.js 20+
- PostgreSQL running locally (or remote connection string)
- API keys for OpenAI and WaveSpeed

## Setup

1. **Install dependencies:**

```bash
npm install
```

2. **Configure environment variables:**

Copy `.env.local` and fill in your values:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_story_creator"
JWT_SECRET="your-random-secret"
OPENAI_API_KEY="sk-..."
WAVESPEED_API_KEY="your-wavespeed-key"
```

3. **Create the database and run migrations:**

```bash
# Create the database first (if needed)
createdb ai_story_creator

# Run Prisma migration
npx prisma migrate dev --name init
```

4. **Start the development server:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## User Flow

1. **Register/Login** — Create an account (new users get 10,000 credits)
2. **Create Characters** — Use AI to generate character images from text descriptions
3. **Create Story** — Three-step wizard:
   - **Setup:** Enter story prompt, select characters, choose duration and settings
   - **Review:** Edit the AI-generated script (dialogue and scene descriptions)
   - **Generate:** Watch as AI creates voice audio, scene images, and video segments

## API Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /api/auth/register` | No | Create account |
| `POST /api/auth/login` | No | Sign in |
| `GET /api/auth/me` | Yes | Get current user |
| `GET /api/characters` | Yes | List characters |
| `POST /api/characters` | Yes | Save character |
| `POST /api/characters/generate-image` | Yes | AI image generation |
| `GET /api/story-voices` | No | List available voices |
| `POST /api/story-video/generate-script` | Yes | Generate story script |
| `POST /api/story-video/:id/update-script` | Yes | Update script |
| `POST /api/story-video/:id/generate-assets` | Yes | Start asset generation |
| `POST /api/story-video/:id/generate-video` | Yes | Start video generation |
| `GET /api/projects/:id` | Yes | Get project status |
| `GET /api/projects/:id/logs` | Yes | Get generation logs |

## Credits System

- New users start with **10,000 credits**
- Story cost: `ceil(duration / 30) * 2000` credits
- Credits are deducted when asset generation begins
