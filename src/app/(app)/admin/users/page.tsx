"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import type { UserRole } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/use-auth";

type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  credits: number;
  role: UserRole;
  planId: string | null;
  createdAt: string;
  plan: { id: string; name: string; slug: string } | null;
  projectCount: number;
  characterCount: number;
};

type AdminPlan = {
  id: string;
  name: string;
  slug: string;
  features: unknown;
  monthlyPrice: number;
  yearlyPrice: number;
  includedCredits: number;
};

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [userToDelete, setUserToDelete] = useState<AdminUserRow | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    credits: 0,
    role: "USER" as UserRole,
    planId: "" as string,
  });

  const { data: usersData, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiRequest<{ users: AdminUserRow[] }>("/api/admin/users"),
  });

  const { data: plansData } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: () => apiRequest<{ plans: AdminPlan[] }>("/api/admin/plans"),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      body: Record<string, unknown>;
    }) =>
      apiRequest<{ user: unknown }>(`/api/admin/users/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload.body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success("User updated");
      setEditing(null);
    },
    onError: (err: { error?: string; status?: number }) => {
      toast.error(err?.error || "Update failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ ok: boolean }>(`/api/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success("User deleted");
      setUserToDelete(null);
      if (editing?.id === deletedId) setEditing(null);
    },
    onError: (err: { error?: string }) => {
      toast.error(err?.error || "Delete failed");
    },
  });

  function openEdit(u: AdminUserRow) {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      credits: u.credits,
      role: u.role,
      planId: u.planId ?? "",
    });
  }

  function saveEdit() {
    if (!editing) return;
    const body: Record<string, unknown> = {
      name: form.name,
      email: form.email,
      credits: form.credits,
      role: form.role,
      planId: form.planId || null,
    };
    updateMutation.mutate({ id: editing.id, body });
  }

  const users = usersData?.users ?? [];
  const plans = plansData?.plans ?? [];

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted/50" />;
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/60 overflow-hidden">
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Credits</th>
                  <th className="px-4 py-3 font-medium">Activity</th>
                  <th className="px-4 py-3 font-medium w-28" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-border/40 hover:bg-accent/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{u.name}</p>
                      <p className="text-muted-foreground text-xs">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>
                        {u.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {u.plan ? (
                        <span className="text-muted-foreground">{u.plan.name}</span>
                      ) : (
                        <span className="text-muted-foreground italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {u.credits.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {u.projectCount} projects · {u.characterCount} characters
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-8 w-8"
                          onClick={() => openEdit(u)}
                          aria-label={`Edit ${u.name}`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          disabled={currentUser?.id === u.id || deleteMutation.isPending}
                          title={
                            currentUser?.id === u.id
                              ? "You cannot delete your own account"
                              : `Delete ${u.name}`
                          }
                          onClick={() => setUserToDelete(u)}
                          aria-label={`Delete ${u.name}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="u-name">Name</Label>
              <Input
                id="u-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="u-email">Email</Label>
              <Input
                id="u-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="u-credits">Credits</Label>
              <Input
                id="u-credits"
                type="number"
                min={0}
                value={form.credits}
                onChange={(e) =>
                  setForm((f) => ({ ...f, credits: Number(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => v && setForm((f) => ({ ...f, role: v as UserRole }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">USER</SelectItem>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Plan</Label>
              <Select
                value={form.planId || "__none__"}
                onValueChange={(v) =>
                  v && setForm((f) => ({ ...f, planId: v === "__none__" ? "" : v }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No plan">
                    {(selected: unknown) => {
                      const v = typeof selected === "string" ? selected : "";
                      if (!v || v === "__none__") return "No plan";
                      const fromList = plans.find((p) => p.id === v);
                      if (fromList) return fromList.name;
                      if (editing?.plan?.id === v) return editing.plan.name;
                      return "Unknown plan";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No plan</SelectItem>
                  {form.planId &&
                    !plans.some((p) => p.id === form.planId) && (
                      <SelectItem value={form.planId}>
                        {editing?.plan?.id === form.planId
                          ? editing.plan.name
                          : "Unknown plan"}
                      </SelectItem>
                    )}
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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

      <Dialog open={!!userToDelete} onOpenChange={(o) => !o && setUserToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription>
              This permanently removes{" "}
              <span className="font-medium text-foreground">{userToDelete?.name}</span> (
              {userToDelete?.email}) and all of their projects and characters. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (userToDelete) deleteMutation.mutate(userToDelete.id);
              }}
            >
              Delete user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
