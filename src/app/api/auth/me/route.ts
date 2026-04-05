import { NextRequest } from "next/server";
import { getAuthUser, requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  const authErr = requireAuth(user);
  if (authErr) return authErr;

  return Response.json({ user });
}
