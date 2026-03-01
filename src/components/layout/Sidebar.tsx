"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk, useUser, UserButton } from "@clerk/nextjs";
import {
  FileText, Users, BarChart3, ShieldCheck,
  ClipboardList, Settings, LogOut, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { LogoIcon } from "@/components/ui/LogoIcon";

const NAV = [
  { href: "/encounters", label: "Encounters", icon: FileText },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/prior-auth", label: "Prior Auth", icon: ClipboardList },
  { href: "/compliance", label: "Compliance", icon: ShieldCheck },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <aside className="flex flex-col h-full w-56 bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-1.5 px-4 py-4 border-b border-sidebar-border text-sidebar-foreground">
        <LogoIcon className="w-8 h-8 -ml-1 text-blue-500" />
        <span className="font-semibold text-base mt-0.5">SpecScribe</span>
      </div>

      {/* Status indicator */}
      <div className="px-4 py-2 border-b border-sidebar-border">
        <div className="flex items-center gap-1.5 text-xs text-green-400">
          <Activity className="h-3 w-3" />
          <span>System operational</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
              pathname.startsWith(href)
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 px-2 py-1.5 mb-1">
          <UserButton afterSignOutUrl="/" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">
              {user?.primaryEmailAddress?.emailAddress ?? ""}
            </p>
            <p className="text-xs text-sidebar-foreground/50 truncate capitalize">
              {user?.publicMetadata?.role as string ?? "Practitioner"}
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut({ redirectUrl: "/" })}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
