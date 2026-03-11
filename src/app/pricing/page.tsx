"use client";

import { MarketingNav } from "@/components/layout/MarketingNav";
import { Check, X, ShieldCheck, Clock, Zap, TrendingUp, ArrowRight, UserPlus, Sparkles, Building2 } from "lucide-react";
import Link from "next/link";

export default function PricingPage() {
    return (
        <div className="min-h-screen bg-white selection:bg-blue-500/10">
            <MarketingNav />

            {/* ── HERO / FUNNEL START ── */}
            <section className="relative pt-24 sm:pt-32 pb-16 sm:pb-24 px-6 sm:px-8 overflow-hidden bg-gradient-to-b from-blue-50/50 to-white">
                <div className="absolute top-0 right-0 w-[60%] h-[60%] bg-blue-100/30 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                <div className="max-w-4xl mx-auto text-center relative">
                    <div className="inline-flex items-center gap-2 bg-blue-100 border border-blue-200 rounded-full px-4 py-1.5 text-xs font-black text-blue-600 uppercase tracking-widest mb-6">
                        Maximum ROI for specialty clinics
                    </div>
                    <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.05] mb-6 sm:mb-8">
                        The last documentation tool you&apos;ll <span className="text-blue-600 italic">ever</span> need.
                    </h1>
                    <p className="text-base sm:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed mb-8 sm:mb-12">
                        Stop losing $2,200+ a month in unbillable administrative time. SpecScribe pays for itself in just days, ending the burnout tax for good.
                    </p>

                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Link href="/login?mode=signup" className="group relative flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-10 py-4 rounded-full transition-all shadow-xl shadow-blue-600/30 active:scale-[0.98]">
                            Claim 7-Day Pre-filled Migration
                            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                        </Link>
                        <Link href="/demo" className="flex items-center justify-center gap-2 bg-white border-2 border-slate-100 hover:border-blue-600/20 text-slate-700 font-bold px-10 py-4 rounded-full transition-all">
                            Book a Consultation
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── VALUE PROPOSITION: ROI ── */}
            <section className="py-16 sm:py-24 px-6 sm:px-8 bg-slate-900 overflow-hidden relative">
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #3b82f6 1px, transparent 0)', backgroundSize: '40px 40px' }} />

                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 relative">
                    {[
                        { icon: Clock, title: "Stop the Revenue Leak", desc: "Stop losing billable hours to after-hours charting and administrative tasks.", stat: "$2.2k+", statLabel: "Monthly Lost Revenue Avoided" },
                        { icon: TrendingUp, title: "Higher Billing Accuracy", desc: "AI-suggested billing codes prevent under-billing in 28% of encounters.", stat: "$1.4k", statLabel: "Monthly Revenue Lift" },
                        { icon: ShieldCheck, title: "Bulletproof Compliance", desc: "Automated audit logs and PIPEDA/HIA compliance built-in from day one.", stat: "0", statLabel: "Security Breaches" },
                    ].map((item, idx) => (
                        <div key={idx} className="bg-white/5 border border-white/10 rounded-3xl p-5 md:p-7 backdrop-blur-sm">
                            <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-600/20 rounded-2xl flex items-center justify-center mb-4 md:mb-6">
                                <item.icon className="w-6 h-6 md:w-7 md:h-7 text-blue-400" />
                            </div>
                            <h3 className="text-lg md:text-xl font-bold text-white mb-2 md:mb-3">{item.title}</h3>
                            <p className="text-white/40 text-sm leading-relaxed mb-6 md:mb-8">{item.desc}</p>
                            <div className="pt-4 md:pt-6 border-t border-white/5">
                                <div className="text-3xl font-black text-blue-400">{item.stat}</div>
                                <div className="text-[10px] uppercase font-bold tracking-widest text-white/30 mt-1">{item.statLabel}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── COMPARISON FUNNEL: WHY SPEC SCRIBE? ── */}
            <section className="py-16 md:py-20 lg:py-28 px-6 sm:px-8 bg-white" id="comparison">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-10 sm:mb-20">
                        <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight mb-4">Choose the smarter path.</h2>
                        <p className="text-slate-500 max-w-lg mx-auto">SpecScribe outperforms both traditional human scribes and generic AI tools by focusing purely on Canadian medical context.</p>
                    </div>

                    <div className="overflow-x-auto -mx-6 sm:mx-0 px-6 sm:px-0">
                        <div className="bg-white border border-slate-200 rounded-[3rem] overflow-hidden shadow-2xl min-w-[560px]">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-5 sm:px-8 py-6 text-xs font-black uppercase tracking-widest text-slate-400">Features</th>
                                        <th className="px-5 sm:px-8 py-6 text-xs font-black uppercase tracking-widest text-slate-400">Human Scribe</th>
                                        <th className="px-5 sm:px-8 py-6 text-xs font-black uppercase tracking-widest text-slate-400">Basic AI</th>
                                        <th className="px-5 sm:px-8 py-6 text-xs font-black uppercase tracking-widest text-blue-600 bg-blue-500/5">SpecScribe</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {[
                                        { feature: "Monthly Cost ($/Physician)", human: "$3,500+", basic: "$50 - $100", spec: "From $299" },
                                        { feature: "Accuracy / Nuance", human: "High", basic: "Low - Medium", spec: "Higher (Medical Grade)" },
                                        { feature: "PIPEDA / HIA Compliant", human: "Conditional", basic: "Often No", spec: "Certified & Guaranteed" },
                                        { feature: "Direct EHR Sync", human: "Manual Entry", basic: "Manual Paste", spec: "Automated Integration" },
                                        { feature: "Specialty Intelligence", human: "Variable", basic: "None", spec: "Specialty-specific Models" },
                                    ].map((row, idx) => (
                                        <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                                            <td className="px-5 sm:px-8 py-5 sm:py-6 text-sm font-bold text-slate-900">{row.feature}</td>
                                            <td className="px-5 sm:px-8 py-5 sm:py-6 text-sm text-slate-400">{row.human}</td>
                                            <td className="px-5 sm:px-8 py-5 sm:py-6 text-sm text-slate-400">{row.basic}</td>
                                            <td className="px-5 sm:px-8 py-5 sm:py-6 text-sm font-black text-blue-600 bg-blue-500/5">{row.spec}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── PRICING TIERS ── */}
            <section className="py-16 sm:py-24 px-6 sm:px-8 bg-slate-50">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-7 items-start">

                        {/* Tier: Starter */}
                        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-6 md:p-7 lg:p-9 hover:border-blue-600/20 transition-all flex flex-col">
                            <div className="mb-8">
                                <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Foundation</div>
                                <h3 className="text-2xl font-black text-slate-900 mb-4">Solo Scribe</h3>
                                <p className="text-sm text-slate-500 leading-relaxed mb-6">Functional and solid. Perfect for solo therapists starting out.</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-black text-slate-900">$299</span>
                                    <span className="text-sm text-slate-400 font-bold uppercase tracking-tight">/ Month</span>
                                </div>
                            </div>
                            <div className="space-y-4 mb-10 flex-1">
                                <div className="flex items-center gap-3 text-sm text-slate-600">
                                    <Check className="w-5 h-5 text-green-500 shrink-0" />
                                    <span>Pay-Per-Encounter Trial ($2/ea)</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-600">
                                    <Check className="w-5 h-5 text-green-500 shrink-0" />
                                    <span>Standard specialty templates</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-400 line-through decoration-slate-200">
                                    <X className="w-5 h-5 text-slate-300 shrink-0" />
                                    <span>Prior-Auth Builder</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-400 line-through decoration-slate-200">
                                    <X className="w-5 h-5 text-slate-300 shrink-0" />
                                    <span>SMART on FHIR Sync</span>
                                </div>
                            </div>
                            <Link href="/login?mode=signup" className="w-full text-center bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-slate-800 transition-all">
                                Start with 50 Encounters
                            </Link>
                        </div>

                        {/* Tier: Professional (MOST POPULAR) */}
                        <div className="bg-slate-900 border-2 border-blue-600/50 rounded-[2.5rem] p-6 md:p-7 lg:p-9 shadow-2xl shadow-blue-600/10 relative lg:scale-105 lg:z-10 flex flex-col">
                            <div className="absolute top-0 right-10 -translate-y-1/2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-lg">
                                Most Popular
                            </div>
                            <div className="mb-8">
                                <div className="text-xs font-black uppercase tracking-widest text-blue-400 mb-2">Advanced Workflow</div>
                                <h3 className="text-2xl font-black text-white mb-4">Clinical Command Center</h3>
                                <p className="text-sm text-white/40 leading-relaxed mb-6">Unlimited documentation. Includes Prior-Auth and EHR Sync.</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-black text-white">$499</span>
                                    <span className="text-sm text-white/40 font-bold uppercase tracking-tight">/ Month</span>
                                </div>
                            </div>
                            <div className="space-y-4 mb-10 flex-1 text-white/80">
                                <div className="flex items-center gap-3 text-sm">
                                    <Sparkles className="w-5 h-5 text-blue-400 shrink-0" />
                                    <span>Unlimited encounters & notes</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                    <Check className="w-5 h-5 text-green-500 shrink-0" />
                                    <span>Prior-Auth PDF Generator</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-blue-300">
                                    <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0" />
                                    <span>SMART on FHIR Sync Integration</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-blue-300 font-bold">
                                    <Check className="w-5 h-5 text-green-400 shrink-0" />
                                    <span>7-Day Pre-filled Migration</span>
                                </div>
                            </div>
                            <Link href="/login?mode=signup" className="w-full text-center bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20">
                                Claim 7-Day Pre-filled Migration
                            </Link>
                        </div>

                        {/* Tier: Practice */}
                        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-6 md:p-7 lg:p-9 hover:border-blue-600/20 transition-all flex flex-col">
                            <div className="mb-8">
                                <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Institutional</div>
                                <h3 className="text-2xl font-black text-slate-900 mb-4">Enterprise Clinic</h3>
                                <p className="text-sm text-slate-500 leading-relaxed mb-6">Full institutional deployment with multi-provincial compliance management.</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-black text-slate-900">Custom</span>
                                </div>
                            </div>
                            <div className="space-y-4 mb-10 flex-1">
                                <div className="flex items-center gap-3 text-sm text-slate-600">
                                    <Building2 className="w-5 h-5 text-blue-600 shrink-0" />
                                    <span>Audit-Ready Guarantee (HIA)</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-600">
                                    <Check className="w-5 h-5 text-green-500 shrink-0" />
                                    <span>Clinic-wide custom templates</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-600">
                                    <Check className="w-5 h-5 text-green-500 shrink-0" />
                                    <span>Concierge Migration Service</span>
                                </div>
                            </div>
                            <Link href="/demo" className="w-full text-center bg-slate-100 text-slate-900 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-all">
                                Get Custom Assessment
                            </Link>
                        </div>

                    </div>
                </div>
            </section>

            {/* ── FINAL SOCIAL PROOF + CTA ── */}
            <section className="py-16 sm:py-32 px-6 sm:px-8 text-center bg-white relative">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight mb-6">Ready to reclaim your evenings?</h2>
                    <p className="text-slate-500 text-base sm:text-lg mb-10 sm:mb-12">
                        Join Canada&apos;s forward-thinking specialty practices. See your own actual patient data pre-filled before you pay.
                    </p>
                    <div className="flex flex-col items-center gap-6">
                        <Link href="/login?mode=signup" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-black px-12 py-5 rounded-full shadow-2xl shadow-blue-600/30 transition-all transform hover:scale-105 active:scale-95">
                            Claim 7-Day Pre-filled Migration →
                        </Link>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-green-500" />
                            Integrated PIPEDA & HIA Compliance
                        </p>
                    </div>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer className="bg-slate-900 py-12 px-6 sm:px-8">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row flex-wrap justify-between items-center gap-6 text-sm text-white/30 border-t border-white/5 pt-12">
                    <span className="text-white font-bold tracking-tight">SpecScribe</span>
                    <div className="flex flex-wrap justify-center gap-6 sm:gap-10">
                        <Link href="/privacy" className="hover:text-blue-400 transition-colors">Privacy Policy</Link>
                        <Link href="#" className="hover:text-blue-400 transition-colors">Compliance Hub</Link>
                        <Link href="#" className="hover:text-blue-400 transition-colors">Security Standards</Link>
                    </div>
                    <span>© 2026 SpecScribe Inc. · Made in Canada</span>
                </div>
            </footer>
        </div>
    );
}
