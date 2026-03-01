"use client";

import React, { useState } from 'react';
import { Sparkles, ChevronRight, ChevronLeft, ClipboardList, Tag, AlertCircle } from 'lucide-react';

export function AIInsightsSidebar() {
    const [isOpen, setIsOpen] = useState(true);

    const insights = {
        icd10: [
            { code: "M54.50", desc: "Low back pain, unspecified" },
            { code: "G43.909", desc: "Migraine, unspecified" }
        ],
        actionItems: [
            "Order MRI Lumbar Spine if pain persists > 4 weeks",
            "Refer to Physical Therapy for initial assessment",
            "Schedule follow-up in 14 days"
        ]
    };

    return (
        <div
            className={`fixed right-0 top-16 h-[calc(100vh-4rem)] bg-[#0b0d17]/80 backdrop-blur-2xl border-l border-white/10 transition-all duration-500 ease-in-out z-40 ${isOpen ? 'w-80' : 'w-0'
                }`}
        >
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="absolute -left-10 top-1/2 -translate-y-1/2 p-2 bg-blue-600 border border-white/10 rounded-l-xl text-white shadow-xl"
            >
                {isOpen ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5 translate-x-1" />}
            </button>

            <div className={`h-full overflow-y-auto p-6 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex items-center gap-2 mb-8">
                    <Sparkles className="w-5 h-5 text-blue-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">AI Clinical Insights</h3>
                </div>

                <div className="space-y-8">
                    {/* ICD-10 Suggestions */}
                    <section>
                        <div className="flex items-center gap-2 mb-4 text-white/40">
                            <Tag className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Suggested ICD-10 Codes</span>
                        </div>
                        <div className="space-y-3">
                            {insights.icd10.map((item) => (
                                <div key={item.code} className="p-3 bg-white/5 border border-white/5 rounded-xl group hover:border-blue-500/30 transition-colors">
                                    <div className="text-sm font-bold text-blue-400 mb-1">{item.code}</div>
                                    <div className="text-xs text-white/60 leading-relaxed font-medium">{item.desc}</div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Action Items */}
                    <section>
                        <div className="flex items-center gap-2 mb-4 text-white/40">
                            <ClipboardList className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Action Items</span>
                        </div>
                        <div className="space-y-3">
                            {insights.actionItems.map((item, idx) => (
                                <div key={idx} className="flex gap-3 p-3 bg-white/5 border border-white/5 rounded-xl">
                                    <div className="mt-0.5 text-blue-400">
                                        <AlertCircle className="w-4 h-4" />
                                    </div>
                                    <div className="text-xs text-white/80 leading-relaxed font-medium">{item}</div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Note Quality Score */}
                    <div className="p-4 bg-gradient-to-br from-blue-600/10 to-indigo-600/10 border border-blue-500/20 rounded-2xl">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Note Quality</span>
                            <span className="text-2xl font-black text-white">94/100</span>
                        </div>
                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="w-[94%] h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
