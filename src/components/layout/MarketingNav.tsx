"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoIcon } from "@/components/ui/LogoIcon";
import { SignedIn, SignedOut, UserButton, useAuth } from "@clerk/nextjs";

const links = [
  { href: "/", label: "Home" },
  { href: "/industry-use", label: "Industry Use" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/demo", label: "Book a Demo" },
];

export function MarketingNav() {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#0b0d17] backdrop-blur-sm border-b border-white/5">
      <div className="max-w-7xl mx-auto px-8 h-full grid grid-cols-[auto_1fr_auto] items-center gap-8">

        {/* Logo — left zone */}
        <Link
          href={isSignedIn ? "/dashboard" : "/"}
          className="flex items-center gap-2 shrink-0 text-white hover:text-blue-400 transition-colors"
        >
          <LogoIcon className="w-7 h-7 text-blue-400" />
          <span className="font-bold text-[1rem] tracking-tight translate-y-[1px]">SpecScribe</span>
        </Link>

        {/* Nav links — centered zone (Marketing only) */}
        <div className="flex-1 flex justify-center h-full items-center">
          <SignedOut>
            <nav className="flex items-center justify-center gap-8">
              {links.map(({ href, label }) => {
                const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`text-sm font-medium transition-colors whitespace-nowrap ${isActive
                      ? "text-white"
                      : "text-white/60 hover:text-white"
                      }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </SignedOut>
        </div>

        {/* Actions — right zone */}
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
                className={`text-sm font-semibold transition-colors whitespace-nowrap ${pathname === "/dashboard"
                  ? "text-white"
                  : "text-white/60 hover:text-white"
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
    </header>
  );
}
