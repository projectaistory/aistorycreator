import { NextRequest } from "next/server";
import { getAuthUser, requireAuth } from "@/lib/auth";
import { getStripeConfig } from "@/lib/site-settings";

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  const authErr = requireAuth(user);
  if (authErr) return authErr;

  const cfg = await getStripeConfig();
  return Response.json({
    enabled: cfg.enabled,
    publishableKey: cfg.publishableKey,
  });
}
