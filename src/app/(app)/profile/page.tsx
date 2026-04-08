"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/lib/use-auth";
import { apiRequest, setToken } from "@/lib/api-client";
import type { User } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CreditCard, KeyRound, Mail, ArrowRight } from "lucide-react";
import { toast } from "sonner";

function errMessage(err: unknown, fallback: string) {
  if (err && typeof err === "object" && "error" in err) {
    const m = (err as { error?: string }).error;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailLoading(true);
    try {
      const res = await apiRequest<{ user: User; token: string }>("/api/account/email", {
        method: "PATCH",
        body: JSON.stringify({ email, currentPassword: emailPassword }),
      });
      setToken(res.token);
      queryClient.setQueryData(["auth-user"], res.user);
      setEmail("");
      setEmailPassword("");
      toast.success("Email updated");
    } catch (err) {
      toast.error(errMessage(err, "Could not update email"));
    } finally {
      setEmailLoading(false);
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setPasswordLoading(true);
    try {
      await apiRequest("/api/account/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } catch (err) {
      toast.error(errMessage(err, "Could not update password"));
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-1">
          Update your account email and password.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle>Plan</CardTitle>
          </div>
          <CardDescription>
            You are on{" "}
            <span className="text-foreground font-medium">
              {user?.plan?.name ?? "no plan"}
            </span>
            {user?.plan?.slug ? (
              <Badge variant="secondary" className="ml-2 align-middle">
                {user.plan.slug}
              </Badge>
            ) : null}
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/plans"
            className={cn(buttonVariants({ variant: "default" }), "gap-2 inline-flex w-fit")}
          >
            View plans &amp; upgrade
            <ArrowRight className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <CardTitle>Email</CardTitle>
          </div>
          <CardDescription>
            Signed in as <span className="text-foreground font-medium">{user?.email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitEmail} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="new-email">New email</Label>
              <Input
                id="new-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-current-pw">Current password</Label>
              <Input
                id="email-current-pw"
                type="password"
                autoComplete="current-password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                required
                className="bg-background/50"
              />
            </div>
            <Button type="submit" disabled={emailLoading}>
              {emailLoading ? "Saving…" : "Update email"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <CardTitle>Password</CardTitle>
          </div>
          <CardDescription>Change your password. You will stay signed in.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitPassword} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="current-pw">Current password</Label>
              <Input
                id="current-pw"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-pw">New password</Label>
              <Input
                id="new-pw"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="bg-background/50"
              />
              <p className="text-xs text-muted-foreground">At least 8 characters</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pw">Confirm new password</Label>
              <Input
                id="confirm-pw"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="bg-background/50"
              />
            </div>
            <Button type="submit" disabled={passwordLoading}>
              {passwordLoading ? "Updating…" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
