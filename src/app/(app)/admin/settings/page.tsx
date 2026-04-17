"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import { CreditCard, Globe, KeyRound, Puzzle, Save, Wallet } from "lucide-react";

type SiteSettingRow = {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  updatedAt: string;
};

type FieldKind = "text" | "boolean" | "number" | "secret";

type FieldMeta = {
  section: SectionId;
  label: string;
  hint?: string;
  kind: FieldKind;
};

const SECTION_ORDER = [
  "site",
  "billing",
  "stripe",
  "integrations",
  "other",
] as const;

type SectionId = (typeof SECTION_ORDER)[number];

type SectionDef = {
  id: SectionId;
  title: string;
  blurb: string;
  icon: LucideIcon;
};

const SECTIONS: SectionDef[] = [
  {
    id: "site",
    title: "Site & contact",
    blurb: "What visitors see for your app name and support contact.",
    icon: Globe,
  },
  {
    id: "billing",
    title: "Plans & prices",
    blurb: "Defaults when someone signs up and how plan prices are labeled.",
    icon: Wallet,
  },
  {
    id: "stripe",
    title: "Stripe payments",
    blurb: "Turn on paid plans and paste the keys from your Stripe dashboard.",
    icon: CreditCard,
  },
  {
    id: "integrations",
    title: "AI keys",
    blurb: "Keys for writing stories, voices, images, and video. You can change them anytime.",
    icon: KeyRound,
  },
  {
    id: "other",
    title: "Other",
    blurb: "Extra options stored in the database. Only change these if you know what they do.",
    icon: Puzzle,
  },
];

/** Known keys: friendly copy and grouping. Unknown keys land in “Other”. */
const FIELD_META: Record<string, FieldMeta> = {
  "site.name": {
    section: "site",
    label: "Site name",
    hint: "Shown around the app and in messages to users.",
    kind: "text",
  },
  "site.support_email": {
    section: "site",
    label: "Support email",
    hint: "Where users can reach you for help.",
    kind: "text",
  },
  "billing.default_plan_slug": {
    section: "billing",
    label: "Starting plan",
    hint: "Plan code for new accounts (often free). Must match a plan in Admin → Plans.",
    kind: "text",
  },
  "billing.currency": {
    section: "billing",
    label: "Currency code",
    hint: "Three letters, e.g. USD or EUR, for how prices are shown.",
    kind: "text",
  },
  "billing.stripe.enabled": {
    section: "stripe",
    label: "Accept payments with Stripe",
    hint: "When on, customers can subscribe and manage cards in Stripe Checkout.",
    kind: "boolean",
  },
  "billing.stripe.publishable_key": {
    section: "stripe",
    label: "Publishable key",
    hint: "Starts with pk_live_ or pk_test_. Safe to use in the browser.",
    kind: "text",
  },
  "billing.stripe.secret_key": {
    section: "stripe",
    label: "Secret key",
    hint: "Starts with sk_live_ or sk_test_. Keep private—only used on the server.",
    kind: "secret",
  },
  "billing.stripe.webhook_secret": {
    section: "stripe",
    label: "Webhook signing secret",
    hint: "From Stripe → Developers → Webhooks. Lets the site trust payment events.",
    kind: "secret",
  },
  "billing.stripe.checkout_success_url": {
    section: "stripe",
    label: "After successful checkout",
    hint: "Page to open when payment succeeds. Can be a path like /plans?paid=1.",
    kind: "text",
  },
  "billing.stripe.checkout_cancel_url": {
    section: "stripe",
    label: "If checkout is cancelled",
    hint: "Page to open if the customer closes checkout without paying.",
    kind: "text",
  },
  "billing.stripe.portal_return_url": {
    section: "stripe",
    label: "After billing portal",
    hint: "Where to send people when they leave Stripe’s “manage subscription” page.",
    kind: "text",
  },
  "billing.stripe.trial_days": {
    section: "stripe",
    label: "Free trial length (days)",
    hint: "Number of trial days for new subscriptions. Use 0 for no trial.",
    kind: "number",
  },
  "billing.stripe.allow_promotion_codes": {
    section: "stripe",
    label: "Allow discount codes",
    hint: "Lets customers enter a Stripe promotion or coupon code at checkout.",
    kind: "boolean",
  },
  "integrations.openai.api_key": {
    section: "integrations",
    label: "OpenAI",
    hint: "Powers story scripts. If empty, the server can use an environment variable instead.",
    kind: "secret",
  },
  "integrations.wavespeed.api_key": {
    section: "integrations",
    label: "WaveSpeed",
    hint: "Powers voices, images, and short videos. If empty, the server can use an environment variable instead.",
    kind: "secret",
  },
};

const STRIPE_FIELD_ORDER: string[] = [
  "billing.stripe.enabled",
  "billing.stripe.publishable_key",
  "billing.stripe.secret_key",
  "billing.stripe.webhook_secret",
  "billing.stripe.checkout_success_url",
  "billing.stripe.checkout_cancel_url",
  "billing.stripe.portal_return_url",
  "billing.stripe.trial_days",
  "billing.stripe.allow_promotion_codes",
];

function valueToString(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function parseValue(text: string): unknown {
  const t = text.trim();
  if (t === "true") return true;
  if (t === "false") return false;
  if (/^-?\d+$/.test(t)) return parseInt(t, 10);
  if (/^-?\d*\.\d+$/.test(t)) return parseFloat(t);
  if (
    (t.startsWith("{") && t.endsWith("}")) ||
    (t.startsWith("[") && t.endsWith("]"))
  ) {
    return JSON.parse(t) as unknown;
  }
  return t;
}

function isSecretKey(key: string): boolean {
  return /secret_key$|webhook_secret$|api_key$/i.test(key);
}

function fallbackMeta(key: string): FieldMeta {
  const tail = key.split(".").pop() ?? key;
  const words = tail.replace(/_/g, " ");
  const label = words.charAt(0).toUpperCase() + words.slice(1);
  return {
    section: "other",
    label,
    hint: "Custom or legacy setting.",
    kind: isSecretKey(key) ? "secret" : "text",
  };
}

function metaForKey(key: string): FieldMeta {
  return FIELD_META[key] ?? fallbackMeta(key);
}

function sortRowsInSection(section: SectionId, rows: SiteSettingRow[]): SiteSettingRow[] {
  if (section === "stripe") {
    const rank = new Map(STRIPE_FIELD_ORDER.map((k, i) => [k, i]));
    return [...rows].sort(
      (a, b) => (rank.get(a.key) ?? 999) - (rank.get(b.key) ?? 999)
    );
  }
  return [...rows].sort((a, b) => a.key.localeCompare(b.key));
}

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => apiRequest<{ settings: SiteSettingRow[] }>("/api/admin/settings"),
  });

  const rows = data?.settings ?? [];

  const grouped = useMemo(() => {
    const map = new Map<SectionId, SiteSettingRow[]>();
    for (const id of SECTION_ORDER) map.set(id, []);
    for (const row of rows) {
      const section = metaForKey(row.key).section;
      map.get(section)!.push(row);
    }
    const out = new Map<SectionId, SiteSettingRow[]>();
    for (const id of SECTION_ORDER) {
      const list = map.get(id) ?? [];
      if (list.length > 0) out.set(id, sortRowsInSection(id, list));
    }
    return out;
  }, [rows]);

  function displayFor(s: SiteSettingRow): string {
    return overrides[s.key] !== undefined ? overrides[s.key]! : valueToString(s.value);
  }

  const saveMutation = useMutation({
    mutationFn: (settings: Record<string, unknown>) =>
      apiRequest<{ settings: SiteSettingRow[] }>("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ settings }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      setOverrides((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(variables)) {
          delete next[k];
        }
        return next;
      });
      toast.success("Saved");
    },
    onError: (err: { error?: string }) => toast.error(err?.error || "Save failed"),
  });

  function updateDraft(key: string, text: string) {
    setOverrides((d) => ({ ...d, [key]: text }));
  }

  function saveKey(key: string) {
    const row = rows.find((s) => s.key === key);
    if (!row) return;
    const raw = displayFor(row);
    try {
      const parsed = parseValue(raw);
      saveMutation.mutate({ [key]: parsed });
    } catch {
      toast.error("That value doesn’t look valid. Check numbers or spelling.");
    }
  }

  function saveAll() {
    const settings: Record<string, unknown> = {};
    try {
      for (const s of rows) {
        settings[s.key] = parseValue(displayFor(s));
      }
      if (Object.keys(settings).length === 0) {
        toast.message("Nothing to save yet");
        return;
      }
      saveMutation.mutate(settings);
    } catch {
      toast.error("One of the fields has an invalid value");
    }
  }

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted/50" />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="space-y-1 max-w-xl">
          <h2 className="text-lg font-semibold tracking-tight">Site settings</h2>
          <p className="text-sm text-muted-foreground">
            Update your site, billing, Stripe, and AI keys in plain language. Use{" "}
            <span className="font-medium text-foreground">Save</span> on a row to update
            just that item, or save everything at once.
          </p>
        </div>
        <Button
          onClick={saveAll}
          disabled={saveMutation.isPending || rows.length === 0}
          className="gap-2 shrink-0 w-full sm:w-auto"
        >
          <Save className="size-4" />
          Save all changes
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">No settings found yet.</p>
          </CardContent>
        </Card>
      ) : (
        SECTIONS.filter((s) => grouped.has(s.id)).map((section) => {
          const sectionRows = grouped.get(section.id)!;
          const Icon = section.icon;
          return (
            <Card key={section.id} className="border-border/60 overflow-hidden">
              <CardHeader className="border-b border-border/40 bg-muted/20">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background ring-1 ring-border/60">
                    <Icon className="size-4 text-muted-foreground" aria-hidden />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    <CardDescription>{section.blurb}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                {sectionRows.map((row) => {
                  const meta = metaForKey(row.key);
                  const isSecret = meta.kind === "secret" || isSecretKey(row.key);
                  const visible = !!showSecrets[row.key];
                  const draft = displayFor(row);
                  const showInternalId = section.id === "other";

                  return (
                    <div
                      key={row.id}
                      className="rounded-xl border border-border/60 bg-card/50 p-4 shadow-sm space-y-3"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="min-w-0 space-y-1 flex-1">
                          <Label htmlFor={`setting-${row.id}`} className="text-base font-medium">
                            {meta.label}
                          </Label>
                          {meta.hint ? (
                            <p className="text-sm text-muted-foreground leading-snug">
                              {meta.hint}
                            </p>
                          ) : null}
                          {showInternalId ? (
                            <p className="text-xs font-mono text-muted-foreground/80 pt-1 break-all">
                              {row.key}
                            </p>
                          ) : null}
                        </div>
                        {meta.kind === "boolean" ? (
                          <div className="flex shrink-0 items-center gap-2 sm:pt-0.5">
                            <span className="text-sm text-muted-foreground sm:sr-only">
                              {draft === "true" ? "On" : "Off"}
                            </span>
                            <Switch
                              id={`setting-${row.id}`}
                              checked={draft === "true"}
                              onCheckedChange={(on) =>
                                updateDraft(row.key, on ? "true" : "false")
                              }
                            />
                          </div>
                        ) : null}
                      </div>

                      {meta.kind !== "boolean" ? (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <Input
                            id={`setting-${row.id}`}
                            type={
                              meta.kind === "number"
                                ? "number"
                                : isSecret && !visible
                                  ? "password"
                                  : "text"
                            }
                            min={meta.kind === "number" ? 0 : undefined}
                            step={meta.kind === "number" ? 1 : undefined}
                            className="font-mono text-sm border-2 border-muted-foreground/35 bg-background sm:max-w-xl sm:flex-1 shadow-sm hover:border-muted-foreground/50 focus-visible:border-ring"
                            value={draft}
                            onChange={(e) => updateDraft(row.key, e.target.value)}
                          />
                          {isSecret ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="shrink-0"
                              onClick={() =>
                                setShowSecrets((prev) => ({
                                  ...prev,
                                  [row.key]: !prev[row.key],
                                }))
                              }
                            >
                              {visible ? "Hide" : "Show"}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="flex justify-end pt-1">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => saveKey(row.key)}
                          disabled={saveMutation.isPending}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
