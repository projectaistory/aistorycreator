import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { prisma } from "./prisma";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export interface JWTPayload {
  userId: string;
  email: string;
  /** Present on tokens issued after RBAC; older tokens omit this. */
  role?: UserRole;
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

const authUserSelect = {
  id: true,
  email: true,
  name: true,
  credits: true,
  role: true,
  planId: true,
  createdAt: true,
  plan: { select: { id: true, name: true, slug: true } },
} as const;

export type AuthUser = NonNullable<Awaited<ReturnType<typeof getAuthUser>>>;

export async function getAuthUser(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  try {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: authUserSelect,
    });
    return user;
  } catch {
    return null;
  }
}

export function requireAuth(user: unknown) {
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export function requireAdmin(user: AuthUser | null) {
  const authErr = requireAuth(user);
  if (authErr) return authErr;
  if (user!.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
