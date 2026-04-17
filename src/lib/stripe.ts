import Stripe from "stripe";
import { getStripeConfig } from "@/lib/site-settings";

let stripeClient: Stripe | null = null;
let stripeClientKey = "";

export async function getStripe() {
  const config = await getStripeConfig();
  if (!config.enabled) {
    throw new Error("Stripe billing is disabled in site settings");
  }
  if (!config.secretKey) {
    throw new Error("Missing Stripe secret key");
  }

  if (!stripeClient || stripeClientKey !== config.secretKey) {
    stripeClient = new Stripe(config.secretKey);
    stripeClientKey = config.secretKey;
  }

  return stripeClient;
}
