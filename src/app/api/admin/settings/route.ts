import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getAuthUser, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Keys we allow storing via admin UI (no raw integration secrets). */
const BLOCKED_KEY_SUBSTRINGS = ["secret", "api_key", "apikey", "password", "token"];
/**
 * Explicit allowlist of secret-like keys that admins are expected to manage
 * from the dashboard (overrides {@link BLOCKED_KEY_SUBSTRINGS}).
 */
const ALLOWED_SECRET_KEYS = new Set([
  "billing.stripe.secret_key",
  "billing.stripe.webhook_secret",
  "integrations.openai.api_key",
  "integrations.wavespeed.api_key",
]);

function isBlockedKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (ALLOWED_SECRET_KEYS.has(lower)) return false;
  return BLOCKED_KEY_SUBSTRINGS.some((s) => lower.includes(s));
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  const err = requireAdmin(user);
  if (err) return err;

  const settings = await prisma.siteSetting.findMany({
    orderBy: { key: "asc" },
  });

  return Response.json({
    settings: settings.map((s) => ({
      id: s.id,
      key: s.key,
      value: s.value,
      description: s.description,
      updatedAt: s.updatedAt.toISOString(),
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request);
  const err = requireAdmin(user);
  if (err) return err;

  let body: { settings?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const entries = body.settings;
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
    return Response.json(
      { error: "Expected { settings: { key: value, ... } }" },
      { status: 400 }
    );
  }

  const keys = Object.keys(entries);
  for (const key of keys) {
    if (typeof key !== "string" || !key.trim()) {
      return Response.json({ error: "Invalid setting key" }, { status: 400 });
    }
    if (isBlockedKey(key)) {
      return Response.json(
        { error: `Setting key not allowed: ${key}` },
        { status: 400 }
      );
    }
  }

  if (keys.length === 0) {
    const settings = await prisma.siteSetting.findMany({ orderBy: { key: "asc" } });
    return Response.json({
      settings: settings.map((s) => ({
        id: s.id,
        key: s.key,
        value: s.value,
        description: s.description,
        updatedAt: s.updatedAt.toISOString(),
      })),
    });
  }

  try {
    await prisma.$transaction(
      Object.entries(entries).map(([key, value]) =>
        prisma.siteSetting.upsert({
          where: { key: key.trim() },
          create: {
            key: key.trim(),
            value: value as Prisma.InputJsonValue,
          },
          update: {
            value: value as Prisma.InputJsonValue,
          },
        })
      )
    );

    const settings = await prisma.siteSetting.findMany({ orderBy: { key: "asc" } });
    return Response.json({
      settings: settings.map((s) => ({
        id: s.id,
        key: s.key,
        value: s.value,
        description: s.description,
        updatedAt: s.updatedAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("[admin/settings PATCH]", e);
    return Response.json({ error: "Update failed" }, { status: 500 });
  }
}
