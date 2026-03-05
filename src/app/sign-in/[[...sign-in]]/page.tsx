import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { LogoIcon } from "@/components/ui/LogoIcon";
import { ShieldCheck, LogIn, UserPlus, Clock } from "lucide-react";

const TIMEOUT_MESSAGES: Record<string, string> = {
  idle_timeout: "Your session expired after 15 minutes of inactivity.",
  session_expired: "Your session has reached its 24-hour limit. Please sign in again.",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const timeoutMessage = reason ? TIMEOUT_MESSAGES[reason] : undefined;

  return (
        <div className="min-h-screen bg-[#0b0d17] flex items-center justify-center p-6 selection:bg-blue-500/30 overflow-hidden relative">
            {/* Background Decorative Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
            </div>

            <div className="w-full max-w-[440px] z-10">
                {/* Session timeout / expiry banner */}
                {timeoutMessage && (
                    <div className="mb-6 flex items-start gap-3 px-4 py-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl z-10 relative">
                        <div className="pt-0.5 shrink-0">
                            <Clock className="w-4 h-4 text-amber-400" />
                        </div>
                        <p className="text-[12px] leading-snug text-amber-300/90 font-medium">
                            {timeoutMessage}
                        </p>
                    </div>
                )}

                {/* Logo Section */}
                <div className="text-center mb-10">
                    <Link href="/" className="inline-flex items-center gap-3 group transition-transform hover:scale-105 active:scale-95">
                        <div className="p-2.5 bg-blue-600/10 border border-blue-500/20 rounded-2xl backdrop-blur-sm group-hover:border-blue-500/40 transition-colors">
                            <LogoIcon className="w-10 h-10 text-blue-400" />
                        </div>
                        <div className="text-left">
                            <div className="text-2xl font-black text-white tracking-tight leading-none">SpecScribe</div>
                            <div className="text-[10px] font-bold text-blue-400/60 uppercase tracking-[0.2em] mt-1">Clinical AI</div>
                        </div>
                    </Link>
                </div>

                {/* Auth Card Container */}
                <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden group">
                    {/* Subtle inner glow */}
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                    <div className="relative">
                        {/* Toggle Header */}
                        <div className="flex p-1 bg-white/5 border border-white/10 rounded-2xl mb-8">
                            <Link
                                href="/sign-in"
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 transition-all duration-300"
                            >
                                <LogIn className="w-4 h-4" />
                                Sign In
                            </Link>
                            <Link
                                href="/sign-up"
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl text-white/50 hover:text-white/80 hover:bg-white/5 transition-all duration-300"
                            >
                                <UserPlus className="w-4 h-4" />
                                Sign Up
                            </Link>
                        </div>

                        <SignIn appearance={{
                            elements: {
                                rootBox: 'w-full flex justify-center',
                                card: 'bg-transparent border-none shadow-none p-0 w-full mx-auto',
                                header: 'pt-0 text-center items-center',
                                headerTitle: 'text-2xl font-bold text-white',
                                headerSubtitle: 'text-white/40 text-sm mb-4',
                                main: 'gap-4',
                                form: 'w-full flex flex-col',
                                formButtonPrimary: 'w-full group relative flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl transition-all duration-300 shadow-xl shadow-blue-600/20 active:scale-[0.98] normal-case text-base',
                                socialButtonsBlockButton: 'w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold py-3.5 rounded-2xl transition-all duration-300',
                                socialButtonsBlockButtonText: 'text-sm text-white',
                                dividerLine: 'bg-white/10',
                                dividerText: 'text-[10px] font-black uppercase tracking-[0.2em] text-white/30',
                                formFieldLabel: 'text-xs font-bold text-white/50 uppercase tracking-wider ml-1',
                                formFieldInput: 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium',
                                footer: 'hidden', // Hide the default footer to use our custom toggle and compliance info
                            },
                            layout: {
                                socialButtonsPlacement: 'bottom'
                            }
                        }} />
                    </div>
                </div>

                <div className="mt-8 flex items-center gap-4 py-4 px-5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm z-10 relative">
                    <div className="p-2 bg-blue-500/10 rounded-xl">
                        <ShieldCheck className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="text-[11px] leading-tight">
                        <div className="text-white font-bold opacity-80 mb-0.5">Physical MFA Required</div>
                        <div className="text-white/40">PIPEDA (Federal) and HIA (Alberta) Compliant</div>
                    </div>
                </div>

                {/* Support Links */}
                <div className="mt-8 flex justify-center gap-6 text-[11px] font-bold uppercase tracking-widest text-white/30 z-10 relative">
                    <Link href="/help" className="hover:text-blue-400 transition-colors">Support</Link>
                    <Link href="/security" className="hover:text-blue-400 transition-colors">Security</Link>
                    <Link href="/legal" className="hover:text-blue-400 transition-colors">Legal</Link>
                </div>
            </div>
        </div>
    );
}
