"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk, useUser, UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  ShieldCheck,
  ClipboardList,
  Settings,
  LogOut,
  Activity,
  ChevronLeft,
  ChevronRight,
  DatabaseBackup,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { LogoIcon } from "@/components/ui/LogoIcon";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/encounters", label: "Encounters", icon: FileText, exact: false },
  { href: "/patients", label: "Patients", icon: Users, exact: false },
  { href: "/prior-auth", label: "Prior Auth", icon: ClipboardList, exact: false },
  { href: "/compliance", label: "Compliance", icon: ShieldCheck, exact: false },
  { href: "/analytics", label: "Analytics", icon: BarChart3, exact: false },
  { href: "/settings", label: "Settings", icon: Settings, exact: false },
];

const ADMIN_NAV = [
  { href: "/admin/migration", label: "Migration", icon: DatabaseBackup, exact: false },
];

export function CollapsibleSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) setCollapsed(saved === "true");
    setMounted(true);
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  // Avoid hydration mismatch — render expanded on server
  const isCollapsed = mounted ? collapsed : false;

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar border-r border-sidebar-border shrink-0 transition-[width] duration-200 ease-in-out",
        isCollapsed ? "w-[60px]" : "w-56"
      )}
    >
      {/* Logo + collapse toggle */}
      <div
        className={cn(
          "flex items-center border-b border-sidebar-border h-14 shrink-0",
          isCollapsed ? "justify-center px-2" : "px-4 justify-between"
        )}
      >
        {!isCollapsed && (
          <div className="flex items-center gap-2 text-sidebar-foreground overflow-hidden">
            <LogoIcon className="w-7 h-7 text-blue-500 shrink-0" />
            <span className="font-semibold text-base truncate">SpecScribe</span>
          </div>
        )}
        {isCollapsed ? (
          <button
            onClick={toggle}
            className="p-1.5 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={toggle}
            className="p-1.5 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors shrink-0"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Status indicator */}
      {!isCollapsed && (
        <div className="px-4 py-2 border-b border-sidebar-border">
          <div className="flex items-center gap-1.5 text-xs text-green-400">
            <Activity className="h-3 w-3 shrink-0" />
            <span>System operational</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(href + "/");

          return (
            <Link
              key={href}
              href={href}
              title={isCollapsed ? label : undefined}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                isCollapsed && "justify-center px-2",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span>{label}</span>}
            </Link>
          );
        })}

        {/* Admin-only section */}
        {(user?.publicMetadata?.role === "admin" || user?.publicMetadata?.role === "superadmin") && (
          <>
            {!isCollapsed && (
              <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
                Admin
              </p>
            )}
            {ADMIN_NAV.map(({ href, label, icon: Icon, exact }) => {
              const isActive = exact
                ? pathname === href
                : pathname === href || pathname.startsWith(href + "/");

              return (
                <Link
                  key={href}
                  href={href}
                  title={isCollapsed ? label : undefined}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                    isCollapsed && "justify-center px-2",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!isCollapsed && <span>{label}</span>}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border p-3 shrink-0">
        {isCollapsed ? (
          <div className="flex justify-center">
            <UserButton afterSignOutUrl="/" userProfileMode="modal" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 px-2 py-1.5 mb-1">
              <UserButton afterSignOutUrl="/" userProfileMode="modal" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sidebar-foreground truncate">
                  {user?.primaryEmailAddress?.emailAddress ?? ""}
                </p>
                <p className="text-xs text-sidebar-foreground/50 truncate capitalize">
                  {(user?.publicMetadata?.role as string) ?? "Practitioner"}
                </p>
              </div>
            </div>
            <button
              onClick={() => signOut({ redirectUrl: "/" })}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              Sign out
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
