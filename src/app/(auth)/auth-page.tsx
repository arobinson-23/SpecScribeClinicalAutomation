"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { LogoIcon } from "@/components/ui/LogoIcon";
import { Eye, EyeOff, Loader2, ArrowRight, ShieldCheck, UserPlus, LogIn } from "lucide-react";

export default function AuthPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") ?? "/encounters";

    // URL can specify initial mode, e.g. /auth?mode=signup
    const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";

    const [mode, setMode] = useState<"signin" | "signup">(initialMode);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        practiceName: "",
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        if (mode === "signin") {
            try {
                const result = await signIn("credentials", {
                    email: formData.email,
                    password: formData.password,
                    redirect: false,
                });

                if (result?.error === "ACCOUNT_LOCKED") {
                    toast.error("Account locked. Try again later.");
                    setLoading(false);
                    return;
                }

                if (result?.error || !result?.ok) {
                    toast.error("Invalid email or password");
                    setLoading(false);
                    return;
                }

                // Success - redirect to MFA
                router.push("/mfa/verify?callbackUrl=" + encodeURIComponent(callbackUrl));
            } catch (err) {
                toast.error("An unexpected error occurred");
                setLoading(false);
            }
        } else {
            // Registration logic
            try {
                const res = await fetch("/api/auth/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        practice: {
                            name: formData.practiceName,
                            // Add mock NPI/details for the simple toggle version
                            npi: "0000000000",
                            specialty: "behavioral_health",
                        },
                        admin: {
                            firstName: formData.firstName,
                            lastName: formData.lastName,
                            email: formData.email,
                            password: formData.password,
                        },
                    }),
                });

                if (!res.ok) {
                    const data = await res.json();
                    toast.error(data.error ?? "Registration failed");
                    setLoading(false);
                    return;
                }

                toast.success("Account created successfully!");
                setMode("signin");
                setLoading(false);
            } catch (err) {
                toast.error("Connection error. Please try again.");
                setLoading(false);
            }
        }
    }

    return (
        <div className="min-h-screen bg-[#0b0d17] flex items-center justify-center p-6 selection:bg-blue-500/30">
            {/* Background Decorative Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
            </div>

            <div className="w-full max-w-[440px] z-10">
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

                {/* Auth Card */}
                <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden group">
                    {/* Subtle inner glow */}
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                    <div className="relative">
                        {/* Toggle Header */}
                        <div className="flex p-1 bg-white/5 border border-white/10 rounded-2xl mb-8">
                            <button
                                onClick={() => setMode("signin")}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 ${mode === "signin"
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                                    : "text-white/50 hover:text-white/80 hover:bg-white/5"
                                    }`}
                            >
                                <LogIn className="w-4 h-4" />
                                Sign In
                            </button>
                            <button
                                onClick={() => setMode("signup")}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 ${mode === "signup"
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                                    : "text-white/50 hover:text-white/80 hover:bg-white/5"
                                    }`}
                            >
                                <UserPlus className="w-4 h-4" />
                                Sign Up
                            </button>
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-2">
                            {mode === "signin" ? "Welcome back" : "Join SpecScribe"}
                        </h2>
                        <p className="text-white/40 text-sm mb-8">
                            {mode === "signin"
                                ? "Enter your credentials to access your encounters"
                                : "Register your practice and start documenting with AI"}
                        </p>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {mode === "signup" && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-white/50 uppercase tracking-wider ml-1">First Name</label>
                                            <input
                                                name="firstName"
                                                type="text"
                                                required
                                                value={formData.firstName}
                                                onChange={handleChange}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                                placeholder="Jane"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-white/50 uppercase tracking-wider ml-1">Last Name</label>
                                            <input
                                                name="lastName"
                                                type="text"
                                                required
                                                value={formData.lastName}
                                                onChange={handleChange}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                                placeholder="Smith"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-white/50 uppercase tracking-wider ml-1">Practice Name</label>
                                        <input
                                            name="practiceName"
                                            type="text"
                                            required
                                            value={formData.practiceName}
                                            onChange={handleChange}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                            placeholder="Sunrise Specialty Clinic"
                                        />
                                    </div>
                                </>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-white/50 uppercase tracking-wider ml-1">Work Email</label>
                                <input
                                    name="email"
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                                    placeholder="provider@practice.com"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between ml-1">
                                    <label className="text-xs font-bold text-white/50 uppercase tracking-wider">Password</label>
                                    {mode === "signin" && (
                                        <Link href="/forgot-password" className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-wide">
                                            Forgot?
                                        </Link>
                                    )}
                                </div>
                                <div className="relative group/pass">
                                    <input
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={formData.password}
                                        onChange={handleChange}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                        placeholder="••••••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-white/30 hover:text-white/60 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full group relative flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-all duration-300 shadow-xl shadow-blue-600/20 active:scale-[0.98] mt-4"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        {mode === "signin" ? "Authorize Access" : "Launch Practice"}
                                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Divider */}
                        <div className="relative my-8">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/10"></div>
                            </div>
                            <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.2em]">
                                <span className="bg-[#0b0d17]/50 backdrop-blur-sm px-4 text-white/30">OR</span>
                            </div>
                        </div>

                        {/* Social Auth */}
                        <button
                            onClick={() => signIn("google", { callbackUrl })}
                            className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold py-3.5 rounded-2xl transition-all duration-300 group/google"
                        >
                            <svg className="w-5 h-5 transition-transform group-hover/google:scale-110" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1.01.68-2.33 1.09-3.71 1.09-2.85 0-5.27-1.92-6.13-4.51H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.87 14.15c-.21-.65-.32-1.34-.32-2.05s.12-1.4.32-2.05V7.21H2.18C1.41 8.66 1 10.28 1 12s.41 3.34 1.18 4.79l3.69-2.64z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.21l3.69 2.14c.86-2.59 3.28-4.51 6.13-4.51z"
                                    fill="#EA4335"
                                />
                            </svg>
                            <span className="text-sm">Continue with Google</span>
                        </button>

                        <div className="mt-8 flex items-center gap-4 py-4 px-5 bg-white/5 border border-white/10 rounded-2xl">
                            <div className="p-2 bg-blue-500/10 rounded-xl">
                                <ShieldCheck className="w-5 h-5 text-blue-400" />
                            </div>
                            <div className="text-[11px] leading-tight">
                                <div className="text-white font-bold opacity-80 mb-0.5">Physical MFA Required</div>
                                <div className="text-white/40">PIPEDA (Federal) and HIA (Alberta) Compliant</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Support Links */}
                <div className="mt-8 flex justify-center gap-6 text-[11px] font-bold uppercase tracking-widest text-white/30">
                    <Link href="/help" className="hover:text-blue-400 transition-colors">Support</Link>
                    <Link href="/security" className="hover:text-blue-400 transition-colors">Security</Link>
                    <Link href="/legal" className="hover:text-blue-400 transition-colors">Legal</Link>
                </div>
            </div>
        </div>
    );
}
