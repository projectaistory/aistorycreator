"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";

type AdminPlan = {
  id: string;
  name: string;
  slug: string;
  features: unknown;
  monthlyPrice: number;
  yearlyPrice: number;
  monthlyPriceId: string | null;
  yearlyPriceId: string | null;
  includedCredits: number;
  createdAt: string;
  updatedAt: string;
};

function featuresToLines(features: unknown): string {
  if (!Array.isArray(features)) return "";
  return features.map((f) => String(f)).join("\n");
}

function linesToFeatures(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function AdminPlansPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AdminPlan | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    monthlyPrice: 0,
    yearlyPrice: 0,
    monthlyPriceId: "",
    yearlyPriceId: "",
    includedCredits: 0,
    featureLines: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: () => apiRequest<{ plans: AdminPlan[] }>("/api/admin/plans"),
  });

  const updateMutation = useMutation({
    mutationFn: (args: { id: string; body: Record<string, unknown> }) =>
      apiRequest<{ plan: AdminPlan }>(`/api/admin/plans/${args.id}`, {
        method: "PATCH",
        body: JSON.stringify(args.body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      toast.success("Plan updated");
      setEditing(null);
    },
    onError: (err: { error?: string }) => toast.error(err?.error || "Update failed"),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest<{ plan: AdminPlan }>("/api/admin/plans", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      toast.success("Plan created");
      setCreating(false);
      resetForm();
    },
    onError: (err: { error?: string }) => toast.error(err?.error || "Create failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/admin/plans/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      toast.success("Plan deleted");
    },
    onError: (err: { error?: string }) => toast.error(err?.error || "Delete failed"),
  });

  function resetForm() {
    setForm({
      name: "",
      slug: "",
      monthlyPrice: 0,
      yearlyPrice: 0,
      monthlyPriceId: "",
      yearlyPriceId: "",
      includedCredits: 0,
      featureLines: "",
    });
  }

  function openEdit(p: AdminPlan) {
    setEditing(p);
    setForm({
      name: p.name,
      slug: p.slug,
      monthlyPrice: p.monthlyPrice,
      yearlyPrice: p.yearlyPrice,
      monthlyPriceId: p.monthlyPriceId ?? "",
      yearlyPriceId: p.yearlyPriceId ?? "",
      includedCredits: p.includedCredits ?? 0,
      featureLines: featuresToLines(p.features),
    });
  }

  function openCreate() {
    setCreating(true);
    resetForm();
  }

  function saveEdit() {
    if (!editing) return;
    updateMutation.mutate({
      id: editing.id,
      body: {
        name: form.name,
        slug: form.slug,
        monthlyPrice: form.monthlyPrice,
        yearlyPrice: form.yearlyPrice,
        monthlyPriceId: form.monthlyPriceId.trim() || null,
        yearlyPriceId: form.yearlyPriceId.trim() || null,
        includedCredits: form.includedCredits,
        features: linesToFeatures(form.featureLines),
      },
    });
  }

  function saveCreate() {
    createMutation.mutate({
      name: form.name,
      slug: form.slug,
      monthlyPrice: form.monthlyPrice,
      yearlyPrice: form.yearlyPrice,
      monthlyPriceId: form.monthlyPriceId.trim() || null,
      yearlyPriceId: form.yearlyPriceId.trim() || null,
      includedCredits: form.includedCredits,
      features: linesToFeatures(form.featureLines),
    });
  }

  const plans = data?.plans ?? [];

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted/50" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" />
          New plan
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((p) => {
          const feats = Array.isArray(p.features) ? p.features : [];
          return (
            <Card
              key={p.id}
              className="border-border/60 relative overflow-hidden group"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-violet-500 to-fuchsia-500 opacity-80" />
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-xl">{p.name}</CardTitle>
                  <p className="text-xs text-muted-foreground font-mono mt-1">{p.slug}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-8 w-8"
                    onClick={() => openEdit(p)}
                    aria-label={`Edit ${p.name}`}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => {
                      if (
                        confirm(
                          `Delete plan "${p.name}"? Users must be reassigned first.`
                        )
                      ) {
                        deleteMutation.mutate(p.id);
                      }
                    }}
                    aria-label={`Delete ${p.name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-6">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      Monthly
                    </p>
                    <p className="text-2xl font-bold tabular-nums">
                      ${p.monthlyPrice.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      Yearly
                    </p>
                    <p className="text-2xl font-bold tabular-nums">
                      ${p.yearlyPrice.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      Credits included
                    </p>
                    <p className="text-2xl font-bold tabular-nums">
                      {(p.includedCredits ?? 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {feats.length === 0 ? (
                    <li className="italic">No features listed</li>
                  ) : (
                    feats.map((f, i) => (
                      <li key={i} className="flex gap-2">
                        <Check className="size-4 shrink-0 text-primary mt-0.5" />
                        <span>{String(f)}</span>
                      </li>
                    ))
                  )}
                </ul>
                <div className="space-y-1 text-xs font-mono text-muted-foreground">
                  <p>Monthly Price ID: {p.monthlyPriceId || "not set"}</p>
                  <p>Yearly Price ID: {p.yearlyPriceId || "not set"}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit plan</DialogTitle>
          </DialogHeader>
          <PlanFormFields form={form} setForm={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={updateMutation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create plan</DialogTitle>
          </DialogHeader>
          <PlanFormFields form={form} setForm={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button onClick={saveCreate} disabled={createMutation.isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlanFormFields({
  form,
  setForm,
}: {
  form: {
    name: string;
    slug: string;
    monthlyPrice: number;
    yearlyPrice: number;
    monthlyPriceId: string;
    yearlyPriceId: string;
    includedCredits: number;
    featureLines: string;
  };
  setForm: React.Dispatch<
    React.SetStateAction<{
      name: string;
      slug: string;
      monthlyPrice: number;
      yearlyPrice: number;
      monthlyPriceId: string;
      yearlyPriceId: string;
      includedCredits: number;
      featureLines: string;
    }>
  >;
}) {
  return (
    <div className="grid gap-4 py-2">
      <div className="grid gap-2">
        <Label htmlFor="p-name">Name</Label>
        <Input
          id="p-name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="p-slug">Slug</Label>
        <Input
          id="p-slug"
          value={form.slug}
          onChange={(e) =>
            setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().trim() }))
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="p-monthly">Monthly ($)</Label>
          <Input
            id="p-monthly"
            type="number"
            min={0}
            step="0.01"
            value={form.monthlyPrice}
            onChange={(e) =>
              setForm((f) => ({ ...f, monthlyPrice: Number(e.target.value) || 0 }))
            }
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="p-yearly">Yearly ($)</Label>
          <Input
            id="p-yearly"
            type="number"
            min={0}
            step="0.01"
            value={form.yearlyPrice}
            onChange={(e) =>
              setForm((f) => ({ ...f, yearlyPrice: Number(e.target.value) || 0 }))
            }
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="p-monthly-id">Stripe Monthly Price ID</Label>
        <Input
          id="p-monthly-id"
          value={form.monthlyPriceId}
          placeholder="price_..."
          onChange={(e) =>
            setForm((f) => ({ ...f, monthlyPriceId: e.target.value.trim() }))
          }
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="p-yearly-id">Stripe Yearly Price ID</Label>
        <Input
          id="p-yearly-id"
          value={form.yearlyPriceId}
          placeholder="price_..."
          onChange={(e) =>
            setForm((f) => ({ ...f, yearlyPriceId: e.target.value.trim() }))
          }
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="p-credits">Credits included</Label>
        <Input
          id="p-credits"
          type="number"
          min={0}
          step={1}
          value={form.includedCredits}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              includedCredits: Math.max(0, Math.floor(Number(e.target.value) || 0)),
            }))
          }
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="p-features">Features (one per line)</Label>
        <Textarea
          id="p-features"
          rows={6}
          className="font-mono text-sm"
          value={form.featureLines}
          onChange={(e) => setForm((f) => ({ ...f, featureLines: e.target.value }))}
        />
      </div>
    </div>
  );
}
