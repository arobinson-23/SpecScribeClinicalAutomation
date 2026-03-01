"use client";

import { useState } from "react";
import { MarketingNav } from "@/components/layout/MarketingNav";
import { toast } from "sonner";
import { Loader2, Calendar, Users, Building2, CheckCircle2, ArrowRight, Mail } from "lucide-react";
import Link from "next/link";

export default function DemoPage() {
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        practiceName: "",
        specialty: "",
        practiceSize: "1-5",
        message: ""
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch("/api/demo", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                setSubmitted(true);
                toast.success("Demo request sent! We'll be in touch shortly.");
            } else {
                toast.error("Something went wrong. Please try again.");
            }
        } catch (error) {
            toast.error("Failed to send request.");
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-white">
                <MarketingNav />
                <div className="pt-32 pb-20 px-8 flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
                    <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-8 animate-in zoom-in duration-500">
                        <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-4">You&apos;re on the list!</h1>
                    <p className="text-slate-500 text-lg mb-10 leading-relaxed">
                        Thank you for your interest in SpecScribe. One of our clinical specialists will reach out to you within 24 hours to schedule your personalized demo.
                    </p>
                    <Link href="/" className="bg-slate-900 text-white font-bold px-8 py-3 rounded-full hover:bg-slate-800 transition-all">
                        Back to Home
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            <MarketingNav />

            {/* Background elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-blue-50/50 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-[40%] h-[40%] bg-blue-50/30 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2" />
            </div>

            <section className="relative pt-32 pb-20 px-8">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

                    {/* Left: Content */}
                    <div className="lg:sticky lg:top-32">
                        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 text-xs font-bold text-blue-600 uppercase tracking-wide mb-6">
                            ✦ Premium Clinical Demo
                        </div>
                        <h1 className="text-5xl font-black text-slate-900 tracking-tight leading-[1.1] mb-6">
                            See how AI fits into your <span className="text-blue-600">workflow.</span>
                        </h1>
                        <p className="text-lg text-slate-500 mb-10 leading-relaxed">
                            Join over 50+ Canadian specialty practices already reclaiming their evenings with SpecScribe. We&apos;ll show you:
                        </p>

                        <div className="space-y-6">
                            {[
                                { icon: Users, title: "Real-time Ambient Scribing", desc: "Watch how SpecScribe captures nuances in complex specialty encounters." },
                                { icon: Mail, title: "Automated Letters & Handouts", desc: "Generate professional referral letters and patient instructions instantly." },
                                { icon: Calendar, title: "Direct EHR Integration", desc: "See how notes sync seamlessly into your preferred platform." }
                            ].map((item, idx) => (
                                <div key={idx} className="flex gap-5 group">
                                    <div className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center shrink-0 shadow-sm group-hover:border-blue-200 group-hover:bg-blue-50 transition-all duration-300">
                                        <item.icon className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 mb-1">{item.title}</h3>
                                        <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Form Card */}
                    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 lg:p-10 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                            <Building2 className="w-32 h-32" />
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5 relative">
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                <input
                                    required
                                    name="name"
                                    type="text"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600/30 transition-all"
                                    placeholder="Dr. Sarah Johnson"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Medical Email</label>
                                <input
                                    required
                                    name="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600/30 transition-all"
                                    placeholder="sarah.johnson@practice.ca"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Practice Name</label>
                                    <input
                                        required
                                        name="practiceName"
                                        type="text"
                                        value={formData.practiceName}
                                        onChange={handleChange}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600/30 transition-all"
                                        placeholder="City Specialist Centre"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Specialty</label>
                                    <select
                                        name="specialty"
                                        value={formData.specialty}
                                        onChange={handleChange}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600/30 transition-all appearance-none"
                                    >
                                        <option value="">Select Specialty</option>
                                        <option value="psychiatry">Psychiatry</option>
                                        <option value="orthopedics">Orthopedics</option>
                                        <option value="cardiology">Cardiology</option>
                                        <option value="family_medicine">Family Medicine</option>
                                        <option value="other">Other Specialty</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Anything specific you&apos;d like to see?</label>
                                <textarea
                                    name="message"
                                    rows={3}
                                    value={formData.message}
                                    onChange={handleChange}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600/30 transition-all resize-none"
                                    placeholder="E.g. Integration with my specific EHR..."
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full group flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-all duration-300 shadow-xl shadow-blue-600/20 active:scale-[0.98] mt-6"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        Schedule Initial Consultation
                                        <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                                    </>
                                )}
                            </button>

                            <p className="text-[10px] text-center text-slate-400 font-medium uppercase tracking-widest">
                                Compliant under PIPEDA & HIA
                            </p>
                        </form>
                    </div>
                </div>
            </section>
        </div>
    );
}
