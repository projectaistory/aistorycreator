"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  BookOpen,
  Film,
  Wand2,
  Zap,
  ChevronDown,
  Check,
  Play,
  ArrowRight,
  Star,
  Users,
  Video,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Plan {
  id: string;
  name: string;
  slug: string;
  features: unknown;
  monthlyPrice: number;
  yearlyPrice: number;
  includedCredits: number;
  createdAt: string;
  updatedAt: string;
}

interface HomePageProps {
  plans: Plan[];
}

export function HomePage({ plans }: HomePageProps) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <GridBackground />
      <Navbar />
      <main>
        <HeroSection />
        <VideoShowcase />
        <HowItWorks />
        <PricingSection plans={plans} />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}

function GridBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.2_0.08_280),transparent_60%)]" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(oklch(0.5 0.05 280) 1px, transparent 1px),
            linear-gradient(90deg, oklch(0.5 0.05 280) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />
    </div>
  );
}

function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-background/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/20">
            <Sparkles className="size-5 text-primary" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            AI Story Creator
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#showcase"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Showcase
          </a>
          <a
            href="#how-it-works"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            How It Works
          </a>
          <a
            href="#pricing"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Pricing
          </a>
          <a
            href="#faq"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            FAQ
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Get Started
            <ArrowRight className="ml-1 size-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative z-10 px-6 pb-16 pt-16 md:pb-20 md:pt-24">
      <div className="mx-auto max-w-5xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
          <Zap className="size-3.5" />
          Powered by Advanced AI
        </div>

        <h1 className="hero-title mx-auto max-w-4xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-7xl">
          Transform your ideas into{" "}
          <span className="bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent">
            cinematic stories
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
          Create stunning AI-generated story videos with custom characters,
          narration, and professional-quality scenes — all from a simple text
          prompt.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/register"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-12 px-8 text-base"
            )}
          >
            Start Creating Free
            <Sparkles className="ml-2 size-4" />
          </Link>
          <a
            href="#showcase"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-12 px-8 text-base"
            )}
          >
            <Play className="mr-2 size-4" />
            Watch Examples
          </a>
        </div>

        <div className="mt-12 flex items-center justify-center gap-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Users className="size-4" />
            <span>10,000+ creators</span>
          </div>
          <div className="flex items-center gap-2">
            <Video className="size-4" />
            <span>50,000+ videos made</span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="size-4 text-yellow-500" />
            <span>4.9/5 rating</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Bunny Stream "play" links auto-start; use the embed player with autoplay off so
 * posters/thumbnails stay visible until the user hits play inside the iframe.
 */
function bunnyStreamEmbedSrc(playUrl: string): string {
  try {
    const u = new URL(playUrl);
    const segments = u.pathname.split("/").filter(Boolean);
    const playIdx = segments.indexOf("play");
    if (playIdx !== -1 && segments.length >= playIdx + 3) {
      const libraryId = segments[playIdx + 1];
      const videoId = segments[playIdx + 2];
      return `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?autoplay=false`;
    }
  } catch {
    /* ignore */
  }
  return playUrl;
}

function VideoShowcase() {
  const videos = [
    {
      title: "Fantasy Adventure",
      description: "A hero's journey through enchanted lands",
      embedUrl:
        "https://player.mediadelivery.net/play/634572/2f956f34-dbc7-4b21-aaa7-eb2f731329bf",
      gradient: "from-violet-600/20 to-indigo-600/20",
      accent: "bg-violet-500",
    },
    {
      title: "Sci-Fi Epic",
      description: "Interstellar exploration and alien encounters",
      embedUrl:
        "https://player.mediadelivery.net/play/634572/6c4a0d2a-1aa6-4496-9100-c79cc7f805fc",
      gradient: "from-cyan-600/20 to-blue-600/20",
      accent: "bg-cyan-500",
    },
    {
      title: "Mystery Thriller",
      description: "Dark secrets and unexpected twists",
      embedUrl:
        "https://player.mediadelivery.net/play/634572/c81bc593-6e8e-40a1-bbe4-e41abaa27eea",
      gradient: "from-rose-600/20 to-orange-600/20",
      accent: "bg-rose-500",
    },
    {
      title: "Children's Tale",
      description: "Whimsical adventures for young minds",
      embedUrl:
        "https://player.mediadelivery.net/play/634572/2340fd24-ed6a-4ae0-9c31-d0c4d137dcbb",
      gradient: "from-emerald-600/20 to-teal-600/20",
      accent: "bg-emerald-500",
    },
    {
      title: "Horror Story",
      description: "Spine-chilling narratives that haunt",
      embedUrl:
        "https://player.mediadelivery.net/play/634572/bdade93e-0029-4b8b-8794-39d4b89a3d37",
      gradient: "from-red-600/20 to-purple-600/20",
      accent: "bg-red-500",
    },
  ];

  return (
    <section id="showcase" className="relative z-10 px-6 py-16 md:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 text-center">
          <Badge variant="outline" className="mb-4">
            <Film className="mr-1 size-3" /> Video Showcase
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Stories brought to life
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            From fantasy epics to bedtime stories — see what creators are making
            with AI Story Creator.
          </p>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin md:gap-6">
          {videos.map((video, i) => (
            <div
              key={i}
              className="group relative flex-none snap-center"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div
                className={cn(
                  "relative flex h-[420px] w-[315px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-b md:h-[520px] md:w-[390px]",
                  video.gradient
                )}
              >
                <iframe
                  src={bunnyStreamEmbedSrc(video.embedUrl)}
                  title={video.title}
                  className="absolute inset-0 h-full w-full border-0"
                  loading="lazy"
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                  allowFullScreen
                />

                {/* Bottom gradient */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
                  <p className="text-xs font-medium text-white/80">
                    {video.title}
                  </p>
                  <p className="text-[10px] text-white/40">{video.description}</p>
                </div>

                {/* Decorative shimmer */}
                <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-b from-white/5 via-transparent to-transparent" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: BookOpen,
      step: "01",
      title: "Describe Your Story",
      description:
        "Write a prompt or choose from templates. Describe your plot, setting, characters, and mood — the AI handles the rest.",
    },
    {
      icon: Wand2,
      step: "02",
      title: "AI Generates Scenes",
      description:
        "Our AI crafts a full script, generates stunning visuals for each scene, and produces professional narration with your chosen voice.",
    },
    {
      icon: Film,
      step: "03",
      title: "Export & Share",
      description:
        "Review your story, make edits, then export in HD or 4K. Share directly to social media or download for any use.",
    },
  ];

  return (
    <section id="how-it-works" className="relative z-10 px-6 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <Badge variant="outline" className="mb-4">
            <Zap className="mr-1 size-3" /> Simple Process
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Three steps to your story
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            No editing skills needed. Go from idea to finished video in minutes.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step, i) => (
            <div key={i} className="group relative">
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="absolute right-0 top-16 hidden h-px w-6 translate-x-full bg-gradient-to-r from-border to-transparent md:block" />
              )}

              <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-card/50 p-8 transition-all duration-300 hover:border-primary/20 hover:bg-card/80">
                {/* Step number */}
                <div className="absolute right-4 top-4 text-5xl font-black text-white/[0.03]">
                  {step.step}
                </div>

                <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                  <step.icon className="size-6" />
                </div>

                <h3 className="mb-3 text-lg font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection({ plans }: { plans: Plan[] }) {
  const [annual, setAnnual] = useState(false);

  const planMeta: Record<string, { popular?: boolean; cta: string }> = {
    free: { cta: "Get Started" },
    basic: { popular: true, cta: "Start Free Trial" },
    pro: { cta: "Go Pro" },
  };

  return (
    <section id="pricing" className="relative z-10 px-6 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <Badge variant="outline" className="mb-4">
            <Sparkles className="mr-1 size-3" /> Pricing
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Plans for every creator
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Start free and scale as you grow. No hidden fees.
          </p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-white/10 bg-card/50 p-1.5">
            <button
              onClick={() => setAnnual(false)}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition-all",
                !annual
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition-all",
                annual
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Yearly
              <span className="ml-1.5 text-xs opacity-80">Save 20%</span>
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const meta = planMeta[plan.slug] ?? { cta: "Get Started" };
            const features = Array.isArray(plan.features)
              ? (plan.features as string[])
              : [];
            const price = annual ? plan.yearlyPrice : plan.monthlyPrice;
            const period = annual ? "/year" : "/month";

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative flex flex-col overflow-hidden rounded-2xl border p-8 transition-all duration-300",
                  meta.popular
                    ? "border-primary/30 bg-gradient-to-b from-primary/5 to-card/80 shadow-lg shadow-primary/5"
                    : "border-white/5 bg-card/50 hover:border-white/10"
                )}
              >
                {meta.popular && (
                  <div className="absolute right-4 top-4">
                    <Badge className="bg-primary/20 text-primary">
                      Popular
                    </Badge>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-4xl font-bold">
                      ${price === 0 ? "0" : price}
                    </span>
                    {price > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {period}
                      </span>
                    )}
                  </div>
                  {price === 0 && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Free forever
                    </p>
                  )}
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className={cn(
                    buttonVariants({
                      variant: meta.popular ? "default" : "outline",
                      size: "lg",
                    }),
                    "w-full"
                  )}
                >
                  {meta.cta}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const faqs = [
    {
      question: "How does AI Story Creator work?",
      answer:
        "Simply describe your story idea in a text prompt. Our AI generates a complete script, creates visual scenes, adds narration with professional voice acting, and compiles everything into a polished video — all automatically.",
    },
    {
      question: "Do I need any video editing experience?",
      answer:
        "Not at all! AI Story Creator handles all the technical work. You just provide the creative direction through your text prompt, and our AI takes care of script writing, image generation, voice synthesis, and video compilation.",
    },
    {
      question: "What kind of stories can I create?",
      answer:
        "Anything you can imagine — fantasy adventures, sci-fi epics, children's bedtime stories, horror tales, romance narratives, educational content, and more. You can customize characters, settings, and narrative styles.",
    },
    {
      question: "How long does it take to generate a video?",
      answer:
        "Most story videos are generated within 5-15 minutes depending on length and complexity. Pro plan users get priority rendering for even faster turnaround times.",
    },
    {
      question: "Can I use the videos commercially?",
      answer:
        "Yes! All videos you create are yours to use. Basic and Pro plans include full commercial rights for social media, YouTube, marketing, and more.",
    },
    {
      question: "What export quality is available?",
      answer:
        "Free plan supports standard quality exports. Basic plan unlocks HD (1080p), and Pro plan includes 4K resolution with priority rendering for the highest quality output.",
    },
  ];

  return (
    <section id="faq" className="relative z-10 px-6 py-16 md:py-20">
      <div className="mx-auto max-w-3xl">
        <div className="mb-16 text-center">
          <Badge variant="outline" className="mb-4">
            FAQ
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Everything you need to know about AI Story Creator.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <FAQItem key={i} question={faq.question} answer={faq.answer} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border transition-colors",
        open ? "border-primary/20 bg-card/80" : "border-white/5 bg-card/30"
      )}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-6 py-5 text-left"
      >
        <span className="pr-4 font-medium">{question}</span>
        <ChevronDown
          className={cn(
            "size-5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-all duration-200",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <p className="px-6 pb-5 text-sm leading-relaxed text-muted-foreground">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
}

function CTASection() {
  return (
    <section className="relative z-10 px-6 py-16 md:py-20">
      <div className="mx-auto max-w-4xl">
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-b from-primary/10 via-card/80 to-card/80 px-8 py-16 text-center md:px-16">
          {/* Glow effects */}
          <div className="absolute -top-24 left-1/2 size-48 -translate-x-1/2 rounded-full bg-primary/20 blur-[100px]" />

          <h2 className="relative text-3xl font-bold tracking-tight md:text-4xl">
            Ready to create your first story?
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-muted-foreground">
            Join thousands of creators turning their ideas into stunning
            AI-generated videos. Start for free — no credit card required.
          </p>
          <div className="relative mt-8">
            <Link
              href="/register"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 px-8 text-base"
              )}
            >
              Get Started Free
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/5 px-6 py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/20">
            <Sparkles className="size-4 text-primary" />
          </div>
          <span className="font-semibold">AI Story Creator</span>
        </div>

        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#" className="transition-colors hover:text-foreground">
            Terms
          </a>
          <a href="#" className="transition-colors hover:text-foreground">
            Privacy
          </a>
          <a href="#" className="transition-colors hover:text-foreground">
            Contact
          </a>
        </div>

        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} AI Story Creator
        </p>
      </div>
    </footer>
  );
}
