import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PLANS = [
  {
    name: "Free",
    slug: "free",
    features: [
      "3 story projects per month",
      "Standard quality exports",
      "Community support",
    ],
    monthlyPrice: 0,
    yearlyPrice: 0,
    monthlyPriceId: null,
    yearlyPriceId: null,
    includedCredits: 2_000,
  },
  {
    name: "Basic",
    slug: "basic",
    features: [
      "25 story projects per month",
      "HD exports",
      "Email support",
      "Custom character styles",
    ],
    monthlyPrice: 9.99,
    yearlyPrice: 99,
    monthlyPriceId: null,
    yearlyPriceId: null,
    includedCredits: 20_000,
  },
  {
    name: "Pro",
    slug: "pro",
    features: [
      "Unlimited story projects",
      "4K exports & priority rendering",
      "Priority support",
      "API access",
      "Team seats (3)",
    ],
    monthlyPrice: 29.99,
    yearlyPrice: 299,
    monthlyPriceId: null,
    yearlyPriceId: null,
    includedCredits: 80_000,
  },
] as const;

const SITE_SETTINGS: {
  key: string;
  value: unknown;
  description?: string;
}[] = [
  {
    key: "site.name",
    value: "AI Story Creator",
    description: "Public site / app name",
  },
  {
    key: "site.support_email",
    value: "support@example.com",
    description: "Contact email shown to users",
  },
  {
    key: "billing.default_plan_slug",
    value: "free",
    description: "Plan slug assigned to new registrations",
  },
  {
    key: "billing.currency",
    value: "USD",
    description: "Display currency for plans",
  },
  {
    key: "billing.stripe.enabled",
    value: false,
    description: "Enable Stripe-hosted checkout for subscriptions",
  },
  {
    key: "billing.stripe.publishable_key",
    value: "",
    description: "Stripe publishable key used by frontend clients",
  },
  {
    key: "billing.stripe.secret_key",
    value: "",
    description: "Stripe secret key used by server APIs",
  },
  {
    key: "billing.stripe.webhook_secret",
    value: "",
    description: "Stripe webhook signing secret for event verification",
  },
  {
    key: "billing.stripe.checkout_success_url",
    value: "/plans?status=success",
    description: "Relative or absolute checkout success return URL",
  },
  {
    key: "billing.stripe.checkout_cancel_url",
    value: "/plans?status=cancelled",
    description: "Relative or absolute checkout cancel return URL",
  },
  {
    key: "billing.stripe.portal_return_url",
    value: "/profile",
    description: "Return destination after Stripe customer portal",
  },
  {
    key: "billing.stripe.trial_days",
    value: 0,
    description: "Default trial days for new subscription checkout sessions",
  },
  {
    key: "billing.stripe.allow_promotion_codes",
    value: true,
    description: "Allow Stripe promotion code entry on checkout",
  },
  {
    key: "integrations.openai.api_key",
    value: "",
    description:
      "OpenAI API key used for story script generation. Falls back to OPENAI_API_KEY env var when empty.",
  },
  {
    key: "integrations.wavespeed.api_key",
    value: "",
    description:
      "WaveSpeed API key used for TTS, scene images, and video generation. Falls back to WAVESPEED_API_KEY env var when empty.",
  },
];

async function main() {
  for (const p of PLANS) {
    await prisma.plan.upsert({
      where: { slug: p.slug },
      create: {
        name: p.name,
        slug: p.slug,
        features: [...p.features],
        monthlyPrice: p.monthlyPrice,
        yearlyPrice: p.yearlyPrice,
        monthlyPriceId: p.monthlyPriceId,
        yearlyPriceId: p.yearlyPriceId,
        includedCredits: p.includedCredits,
      },
      update: {
        name: p.name,
        features: [...p.features],
        monthlyPrice: p.monthlyPrice,
        yearlyPrice: p.yearlyPrice,
        monthlyPriceId: p.monthlyPriceId,
        yearlyPriceId: p.yearlyPriceId,
        includedCredits: p.includedCredits,
      },
    });
  }

  const proPlan = await prisma.plan.findUnique({ where: { slug: "pro" } });
  if (!proPlan) throw new Error("Pro plan missing after seed");

  const adminEmail = "admin@local.dev";
  const passwordHash = await bcrypt.hash("admin123", 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      password: passwordHash,
      name: "admin",
      role: "ADMIN",
      credits: 100_000,
      planId: proPlan.id,
    },
    update: {
      password: passwordHash,
      name: "admin",
      role: "ADMIN",
      planId: proPlan.id,
    },
  });

  for (const s of SITE_SETTINGS) {
    await prisma.siteSetting.upsert({
      where: { key: s.key },
      create: {
        key: s.key,
        value: s.value as Prisma.InputJsonValue,
        description: s.description,
      },
      update: {
        value: s.value as Prisma.InputJsonValue,
        description: s.description,
      },
    });
  }

  console.log("Seed OK: plans, site settings, admin user (admin@local.dev / admin123)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
