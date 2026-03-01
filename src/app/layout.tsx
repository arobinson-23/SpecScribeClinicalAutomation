import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SpecScribe — Clinical Documentation & Compliance",
  description: "AI-powered clinical documentation and compliance automation for specialty medical practices",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SpecScribe",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0d17",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { ClerkProvider } from "@clerk/nextjs";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
          <Providers>
            {children}
            <Toaster position="top-right" richColors />
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
