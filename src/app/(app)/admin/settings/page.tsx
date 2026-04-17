"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save } from "lucide-react";

type SiteSettingRow = {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  updatedAt: string;
};

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

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  /** Local edits only; baseline comes from the query. */
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => apiRequest<{ settings: SiteSettingRow[] }>("/api/admin/settings"),
  });

  function displayFor(s: SiteSettingRow): string {
    return overrides[s.key] !== undefined ? overrides[s.key]! : valueToString(s.value);
  }

  const rows = data?.settings ?? [];

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
      toast.success("Settings saved");
    },
    onError: (err: { error?: string }) => toast.error(err?.error || "Save failed"),
  });

  function updateDraft(key: string, text: string) {
    setOverrides((d) => ({ ...d, [key]: text }));
  }

  function isSecretSetting(key: string) {
    return /secret_key$|webhook_secret$|api_key$/i.test(key);
  }

  function saveKey(key: string) {
    const row = rows.find((s) => s.key === key);
    if (!row) return;
    const raw = displayFor(row);
    try {
      const parsed = parseValue(raw);
      saveMutation.mutate({ [key]: parsed });
    } catch {
      toast.error("Invalid JSON for this value");
    }
  }

  function saveAll() {
    const settings: Record<string, unknown> = {};
    try {
      for (const s of data?.settings ?? []) {
        const raw = displayFor(s);
        settings[s.key] = parseValue(raw);
      }
      if (Object.keys(settings).length === 0) {
        toast.message("Nothing to save");
        return;
      }
      saveMutation.mutate(settings);
    } catch {
      toast.error("Invalid value in one of the fields");
    }
  }

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted/50" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-xl">
          Key/value settings stored in PostgreSQL. Use plain text, numbers, or JSON
          objects/arrays. Secret-like keys are blocked from the API.
        </p>
        <Button
          onClick={saveAll}
          disabled={saveMutation.isPending}
          className="gap-2 shrink-0"
        >
          <Save className="size-4" />
          Save all
        </Button>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Site settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No settings yet.</p>
          ) : (
            rows.map((s, idx) => {
              const currPrefix = s.key.split(".")[0] ?? "other";
              const prevPrefix = rows[idx - 1]?.key.split(".")[0] ?? null;
              const showGroupHeader = idx === 0 || currPrefix !== prevPrefix;
              const isSecret = isSecretSetting(s.key);
              const visible = !!showSecrets[s.key];

              return (
                <div key={s.id} className="space-y-3">
                  {showGroupHeader ? (
                    <div className="pt-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {currPrefix}
                      </p>
                    </div>
                  ) : null}
                  <div className="grid gap-3 pb-8 border-b border-border/40 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Label className="text-base font-mono">{s.key}</Label>
                      {s.description && (
                        <p className="text-xs text-muted-foreground">{s.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type={isSecret && !visible ? "password" : "text"}
                        className="font-mono text-sm border-2 border-muted-foreground/35 bg-background shadow-sm hover:border-muted-foreground/50 focus-visible:border-ring"
                        value={displayFor(s)}
                        onChange={(e) => updateDraft(s.key, e.target.value)}
                      />
                      {isSecret ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setShowSecrets((prev) => ({ ...prev, [s.key]: !prev[s.key] }))
                          }
                        >
                          {visible ? "Hide" : "Show"}
                        </Button>
                      ) : null}
                    </div>
                    <div className="flex justify-end">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => saveKey(s.key)}
                        disabled={saveMutation.isPending}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
