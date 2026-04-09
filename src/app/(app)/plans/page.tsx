"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/use-auth";
import { apiRequest } from "@/lib/api-client";
import type { BillingPlan } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Check, CreditCard, ExternalLink, Sparkles } from "lucide-react";

const billingPortalUrl = process.env.NEXT_PUBLIC_BILLING_PORTAL_URL ?? "";

export default function PlansPage() {
  const { user } = useAuth();
  const [annual, setAnnual] = useState(false);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["public-plans"],
    queryFn: () => apiRequest<BillingPlan[]>("/api/plans"),
  });

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <div className="flex items-center gap-2 text-primary mb-2">
          <Sparkles className="h-5 w-5" />
          <span className="text-sm font-medium">Plans from your workspace</span>
        </div>
        <h1 className="text-3xl font-bold">Plans &amp; billing</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Pricing and features are shown for reference. Self-service plan changes are not
          available yet; new accounts use the free tier.
        </p>
      </div>

      {billingPortalUrl ? (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment &amp; invoices</CardTitle>
            <CardDescription>
              Manage cards, receipts, and subscription with your payment provider.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a
              href={billingPortalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline" }), "gap-2 inline-flex w-fit")}
            >
              <ExternalLink className="h-4 w-4" />
              Open billing portal
            </a>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle>Available plans</CardTitle>
          </div>
          <CardDescription className="flex flex-wrap items-center gap-2">
            Your current plan:{" "}
            <span className="text-foreground font-medium">
              {user?.plan?.name ?? "None"}
            </span>
            {user?.plan?.slug ? (
              <Badge variant="secondary">{user.plan.slug}</Badge>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading plans…</p>
          ) : plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No plans are configured yet. An admin can add plans under Admin → Plans.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">Compare billing periods</p>
                <div className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1">
                  <button
                    type="button"
                    onClick={() => setAnnual(false)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-xs font-medium transition-all",
                      !annual
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnnual(true)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-xs font-medium transition-all",
                      annual
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Yearly
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {plans.map((plan) => {
                  const features = Array.isArray(plan.features) ? (plan.features as string[]) : [];
                  const price = annual ? plan.yearlyPrice : plan.monthlyPrice;
                  const period = annual ? "/yr" : "/mo";
                  const isCurrent = user?.planId === plan.id;

                  return (
                    <div
                      key={plan.id}
                      className={cn(
                        "rounded-xl border p-5 flex flex-col gap-4 min-h-[220px]",
                        isCurrent ? "border-primary/40 bg-primary/5" : "border-border/80 bg-card/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-lg">{plan.name}</h3>
                          <div className="mt-2 flex items-baseline gap-1">
                            <span className="text-3xl font-bold">
                              ${price === 0 ? "0" : price}
                            </span>
                            {price > 0 && (
                              <span className="text-sm text-muted-foreground">{period}</span>
                            )}
                          </div>
                          {price === 0 && (
                            <p className="mt-1 text-xs text-muted-foreground">No charge</p>
                          )}
                        </div>
                        {isCurrent && (
                          <Badge className="shrink-0 gap-1">
                            <Check className="h-3 w-3" />
                            Current
                          </Badge>
                        )}
                      </div>
                      {features.length > 0 && (
                        <ul className="text-sm text-muted-foreground space-y-2 flex-1">
                          {features.map((f, i) => (
                            <li key={i} className="flex gap-2">
                              <Check className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Separator className="opacity-50" />
                      <Button
                        type="button"
                        variant={isCurrent ? "secondary" : "outline"}
                        className="w-full"
                        disabled
                        title={
                          isCurrent
                            ? "Your current plan"
                            : "Plan upgrades are not available yet"
                        }
                      >
                        {isCurrent ? "Active plan" : "Unavailable"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
