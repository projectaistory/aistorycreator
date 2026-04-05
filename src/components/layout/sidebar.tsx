"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/use-auth";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Film,
  PlusCircle,
  LogOut,
  Coins,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/characters", label: "Characters", icon: Users },
  { href: "/characters/create", label: "Create Character", icon: UserPlus },
  { href: "/stories", label: "My Stories", icon: Film },
  { href: "/stories/create", label: "Create Story", icon: PlusCircle },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 flex-shrink-0 border-r border-border/50 bg-sidebar flex flex-col h-full">
      <div className="p-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">AI Story</h1>
            <p className="text-xs text-muted-foreground -mt-0.5">Creator</p>
          </div>
        </Link>
      </div>

      <Separator className="opacity-50" />

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <item.icon className="w-4.5 h-4.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 space-y-3">
        <Separator className="opacity-50" />
        {user && (
          <div className="flex items-center justify-between px-2">
            <span className="text-xs text-muted-foreground truncate">{user.name}</span>
            <Badge variant="secondary" className="gap-1 text-xs">
              <Coins className="w-3 h-3" />
              {user.credits.toLocaleString()}
            </Badge>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={() => {
            logout();
            window.location.href = "/login";
          }}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
