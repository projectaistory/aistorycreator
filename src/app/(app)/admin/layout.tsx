"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/use-auth";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, CreditCard, Settings2 } from "lucide-react";

const subNav = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/plans", label: "Plans", icon: CreditCard },
  { href: "/admin/settings", label: "Site settings", icon: Settings2 },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && user && user.role !== "ADMIN") {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;
  if (user.role !== "ADMIN") return null;

  return (
    <div className="space-y-8 -mx-2">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Administration
        </p>
        <h1 className="text-3xl font-bold mt-1">Admin dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Manage users, subscription plans, and site configuration.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2 border-b border-border/60 pb-4">
        {subNav.map((item) => {
          const active = item.end
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
