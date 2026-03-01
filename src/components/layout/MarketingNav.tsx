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
        {/* 3-column grid so logo is always truly centered */}
        <div className="md:hidden grid grid-cols-[1fr_auto_1fr] items-center h-full px-3">

          {/* Left — hamburger */}
          <div className="flex items-center justify-start">
            <SignedOut>
              <button
                onClick={() => setMobileMenuOpen((o) => !o)}
                className="flex items-center justify-center w-10 h-10 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen
                  ? <X className="w-5 h-5" />
                  : <Menu className="w-5 h-5" />
                }
              </button>
            </SignedOut>
          </div>

          {/* Center — logo */}
          <Link
            href={isSignedIn ? "/dashboard" : "/"}
            className="flex items-center gap-2 text-white hover:text-blue-400 transition-colors"
          >
            <LogoIcon className="w-7 h-7 text-blue-400" />
            <span className="font-bold text-[1rem] tracking-tight">SpecScribe</span>
          </Link>

          {/* Right — CTA / user */}
          <div className="flex items-center justify-end">
            <SignedOut>
              <Link
                href="/sign-up"
                className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-full transition-colors shadow-lg shadow-blue-600/20"
              >
                Get Started
              </Link>
            </SignedOut>
            <SignedIn>
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard"
                  className="text-sm font-semibold text-white/70 hover:text-white transition-colors"
                >
                  Dashboard
                </Link>
                <UserButton afterSignOutUrl="/" />
              </div>
            </SignedIn>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer ── */}
      {mobileMenuOpen && (
        <>
          {/* Dim backdrop */}
          <div
            className="fixed inset-0 top-16 z-30 md:hidden bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Panel */}
          <div className="fixed top-16 left-0 right-0 z-40 md:hidden bg-[#0b0d17] border-b border-white/10 shadow-2xl shadow-black/60">

            {/* Nav links */}
            <nav className="flex flex-col items-center px-5 pt-5 pb-2 gap-1">
              {links.map(({ href, label }) => {
                const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`w-full text-center text-[0.95rem] font-medium py-4 rounded-xl transition-all ${
                      isActive
                        ? "text-white bg-white/10 font-semibold"
                        : "text-white/55 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>

            {/* Log In row */}
            <div className="border-t border-white/10 mx-5 mt-2 py-5 flex justify-center">
              <Link
                href="/sign-in"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm text-white/40 hover:text-white transition-colors"
              >
                Already have an account?{" "}
                <span className="text-blue-400 font-semibold hover:text-blue-300">Log In</span>
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}
