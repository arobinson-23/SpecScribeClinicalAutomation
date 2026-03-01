"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { LogoIcon } from "@/components/ui/LogoIcon";
import { SignedIn, SignedOut, UserButton, useAuth } from "@clerk/nextjs";

const links = [
  { href: "/", label: "Home" },
  { href: "/industry-use", label: "Industry Use" },
  { href: "/pricing", label: "Pricing" },
  { href: "/demo", label: "Book a Demo" },
];

export function MarketingNav() {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#0b0d17] backdrop-blur-sm border-b border-white/5">

        {/* ── Desktop layout (md+) ── */}
        <div className="hidden md:grid max-w-7xl mx-auto px-8 h-full grid-cols-[auto_1fr_auto] items-center gap-8">

          {/* Logo — left */}
          <Link
            href={isSignedIn ? "/dashboard" : "/"}
            className="flex items-center gap-2 shrink-0 text-white hover:text-blue-400 transition-colors"
          >
            <LogoIcon className="w-7 h-7 text-blue-400" />
            <span className="font-bold text-[1rem] tracking-tight translate-y-[1px]">SpecScribe</span>
          </Link>

          {/* Nav links — center */}
          <div className="flex-1 flex justify-center h-full items-center">
            <SignedOut>
              <nav className="flex items-center justify-center gap-8">
                {links.map(({ href, label }) => {
                  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`text-sm font-medium transition-colors whitespace-nowrap ${
                        isActive ? "text-white" : "text-white/60 hover:text-white"
                      }`}
                    >
                      {label}
                    </Link>
                  );
                })}
              </nav>
            </SignedOut>
          </div>

          {/* Actions — right */}
          <div className="flex items-center gap-3 shrink-0 h-full">
            <SignedOut>
              <Link
                href="/sign-in"
                className="text-sm font-medium text-white/70 hover:text-white px-4 py-2 rounded-full transition-colors"
              >
                Log In
              </Link>
              <Link
                href="/sign-up"
                className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 px-5 py-2 rounded-full transition-colors shadow-lg shadow-blue-600/20"
              >
                Get Started
              </Link>
            </SignedOut>
            <SignedIn>
              <div className="flex items-center gap-4">
                <Link
                  href="/dashboard"
                  className={`text-sm font-semibold transition-colors whitespace-nowrap ${
                    pathname === "/dashboard" ? "text-white" : "text-white/60 hover:text-white"
                  }`}
                >
                  Dashboard
                </Link>
                <div className="pl-2 border-l border-white/10 flex items-center">
                  <UserButton afterSignOutUrl="/" />
                </div>
              </div>
            </SignedIn>
          </div>
        </div>

        {/* ── Mobile layout (< md) ── */}
        <div className="md:hidden relative flex items-center h-full px-4">

          {/* Logo — absolute center */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
            <Link
              href={isSignedIn ? "/dashboard" : "/"}
              className="flex items-center gap-2 text-white hover:text-blue-400 transition-colors"
            >
              <LogoIcon className="w-7 h-7 text-blue-400" />
              <span className="font-bold text-[1rem] tracking-tight translate-y-[1px]">SpecScribe</span>
            </Link>
          </div>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2">
            <SignedOut>
              <Link
                href="/sign-in"
                className="text-sm font-medium text-white/70 hover:text-white px-3 py-1.5 rounded-full transition-colors"
              >
                Log In
              </Link>
              <Link
                href="/sign-up"
                className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-full transition-colors shadow-lg shadow-blue-600/20"
              >
                Get Started
              </Link>
              <button
                onClick={() => setMobileMenuOpen((o) => !o)}
                className="ml-1 p-2 text-white/60 hover:text-white transition-colors"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </SignedOut>

            <SignedIn>
              <Link
                href="/dashboard"
                className={`text-sm font-semibold transition-colors whitespace-nowrap ${
                  pathname === "/dashboard" ? "text-white" : "text-white/60 hover:text-white"
                }`}
              >
                Dashboard
              </Link>
              <div className="pl-2 border-l border-white/10 flex items-center">
                <UserButton afterSignOutUrl="/" />
              </div>
            </SignedIn>
          </div>
        </div>
      </header>

      {/* ── Mobile slide-down nav menu ── */}
      {mobileMenuOpen && (
        <div
          className="fixed top-16 left-0 right-0 z-40 md:hidden bg-[#0b0d17]/95 backdrop-blur-md border-b border-white/10"
          onClick={() => setMobileMenuOpen(false)}
        >
          <nav className="flex flex-col px-4 py-3 gap-0.5">
            {links.map(({ href, label }) => {
              const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`text-sm font-medium py-3 px-3 rounded-lg transition-colors ${
                    isActive
                      ? "text-white bg-white/5"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
