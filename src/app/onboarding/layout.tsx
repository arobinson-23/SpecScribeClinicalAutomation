import { LogoIcon } from "@/components/ui/LogoIcon";
import Link from "next/link";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0b0d17] text-white selection:bg-blue-500/30">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
      </div>
      <header className="relative z-10 border-b border-white/5 px-6 py-4">
        <Link href="/" className="inline-flex items-center gap-3 group">
          <div className="p-2 bg-blue-600/10 border border-blue-500/20 rounded-xl">
            <LogoIcon className="w-7 h-7 text-blue-400" />
          </div>
          <div>
            <div className="text-lg font-black text-white tracking-tight leading-none">SpecScribe</div>
            <div className="text-[9px] font-bold text-blue-400/60 uppercase tracking-[0.2em]">Clinical AI</div>
          </div>
        </Link>
      </header>
      <main className="relative z-10">{children}</main>
    </div>
  );
}
