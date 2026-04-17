import { prisma } from "@/lib/prisma";

type StripeConfig = {
  enabled: boolean;
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  checkoutSuccessUrl: string;
  checkoutCancelUrl: string;
  portalReturnUrl: string;
  trialDays: number;
  allowPromotionCodes: boolean;
};

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.siteSetting.findUnique({
    where: { key },
    select: { value: true },
  });
  return row ? (row.value as T) : fallback;
}

export async function getStripeConfig(): Promise<StripeConfig> {
  const keys = [
    "billing.stripe.enabled",
    "billing.stripe.publishable_key",
    "billing.stripe.secret_key",
    "billing.stripe.webhook_secret",
    "billing.stripe.checkout_success_url",
    "billing.stripe.checkout_cancel_url",
    "billing.stripe.portal_return_url",
    "billing.stripe.trial_days",
    "billing.stripe.allow_promotion_codes",
  ] as const;

  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: [...keys] } },
    select: { key: true, value: true },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value] as const));

  const dbSecret = readString(byKey.get("billing.stripe.secret_key"), "");
  const dbWebhookSecret = readString(byKey.get("billing.stripe.webhook_secret"), "");

  return {
    enabled: readBoolean(byKey.get("billing.stripe.enabled"), false),
    publishableKey: readString(byKey.get("billing.stripe.publishable_key"), ""),
    secretKey: dbSecret || process.env.STRIPE_SECRET_KEY || "",
    webhookSecret: dbWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET || "",
    checkoutSuccessUrl: readString(
      byKey.get("billing.stripe.checkout_success_url"),
      "/plans?status=success"
    ),
    checkoutCancelUrl: readString(
      byKey.get("billing.stripe.checkout_cancel_url"),
      "/plans?status=cancelled"
    ),
    portalReturnUrl: readString(byKey.get("billing.stripe.portal_return_url"), "/profile"),
    trialDays: Math.max(0, Math.floor(readNumber(byKey.get("billing.stripe.trial_days"), 0))),
    allowPromotionCodes: readBoolean(
      byKey.get("billing.stripe.allow_promotion_codes"),
      true
    ),
  };
}

export function toAbsoluteUrl(value: string, origin: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  const path = value.startsWith("/") ? value : `/${value}`;
  return `${origin}${path}`;
}

async function readApiKeySetting(
  key: string,
  envVarName: string
): Promise<string> {
  const dbValue = await getSetting<unknown>(key, "");
  const fromDb = readString(dbValue, "").trim();
  if (fromDb) return fromDb;
  return (process.env[envVarName] ?? "").trim();
}

/**
 * OpenAI key — prefers the `integrations.openai.api_key` site setting, then
 * falls back to the legacy `OPENAI_API_KEY` env var so existing deploys keep
 * working until the key is moved into the admin dashboard.
 */
export async function getOpenAiApiKey(): Promise<string> {
  return readApiKeySetting("integrations.openai.api_key", "OPENAI_API_KEY");
}

/**
 * WaveSpeed key — same DB-first, env-fallback resolution as
 * {@link getOpenAiApiKey}, keyed on `integrations.wavespeed.api_key`.
 */
export async function getWaveSpeedApiKey(): Promise<string> {
  return readApiKeySetting(
    "integrations.wavespeed.api_key",
    "WAVESPEED_API_KEY"
  );
}
