"use client";

import React, { useState } from 'react';
import { Sparkles, ChevronRight, ChevronLeft, ClipboardList, Tag, ChevronDown } from 'lucide-react';
import type { CodeType } from "@prisma/client";

interface AIInsightsSidebarProps {
    latestCodes: {
        encounterId: string;
        codes: {
            code: string;
            codeType: CodeType;
            description: string | null;
            aiConfidence: number | null;
        }[];
        aiAcceptanceRate: number | null;
    } | null;
}

function SectionHeader({
    icon: Icon,
    label,
    isOpen,
    onToggle,
}: {
    icon: React.ElementType;
    label: string;
    isOpen: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            onClick={onToggle}
            className="w-full flex items-center justify-between mb-3 text-white/40 hover:text-white/70 transition-colors group"
        >
            <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
            </div>
            <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
            />
        </button>
    );
}

export function AIInsightsSidebar({ latestCodes }: AIInsightsSidebarProps) {
    const [isOpen, setIsOpen] = useState(true);
    const [sections, setSections] = useState({
        icd10: true,
        ahcip: true,
        noteQuality: true,
    });

    const toggle = (key: keyof typeof sections) =>
        setSections((prev) => ({ ...prev, [key]: !prev[key] }));

    const icd10Codes = latestCodes?.codes.filter((c) => c.codeType === "ICD10_CA") ?? [];
    const ahcipCodes = latestCodes?.codes.filter((c) => c.codeType === "AHCIP") ?? [];
    const qualityScore = latestCodes?.aiAcceptanceRate != null
        ? Math.round(latestCodes.aiAcceptanceRate * 100)
        : null;

    return (
        <div
            className={`fixed right-0 top-16 h-[calc(100vh-4rem)] bg-[#0b0d17]/80 backdrop-blur-2xl border-l border-white/10 transition-all duration-500 ease-in-out z-40 ${isOpen ? 'w-80' : 'w-0'}`}
        >
            {/* Slide toggle */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="absolute -left-10 top-1/2 -translate-y-1/2 p-2 bg-blue-600 border border-white/10 rounded-l-xl text-white shadow-xl"
            >
                {isOpen ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5 translate-x-1" />}
            </button>

            <div className={`h-full overflow-y-auto p-6 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="flex items-center gap-2 mb-8">
                    <Sparkles className="w-5 h-5 text-blue-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">AI Clinical Insights</h3>
                </div>

                {latestCodes === null ? (
                    <div className="text-center text-white/30 text-xs mt-16 leading-relaxed">
                        No pending encounters.<br />
                        Start a session to see AI code suggestions.
                    </div>
                ) : (
                    <div className="space-y-6">

                        {/* ICD-10 Suggestions */}
                        <section>
                            <SectionHeader
                                icon={Tag}
                                label="Suggested ICD-10 Codes"
                                isOpen={sections.icd10}
                                onToggle={() => toggle('icd10')}
                            />
                            {sections.icd10 && (
                                <div className="space-y-3">
                                    {icd10Codes.length === 0 ? (
                                        <p className="text-[10px] text-white/30 px-1">No ICD-10 suggestions yet.</p>
                                    ) : (
                                        icd10Codes.map((item) => (
                                            <div key={item.code} className="p-3 bg-white/5 border border-white/5 rounded-xl hover:border-blue-500/30 transition-colors">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="text-sm font-bold text-blue-400">{item.code}</div>
                                                    {item.aiConfidence != null && (
                                                        <span className="text-[10px] text-white/30 font-medium">
                                                            {Math.round(item.aiConfidence * 100)}%
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-white/60 leading-relaxed font-medium">
                                                    {item.description ?? "—"}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </section>

                        {/* AHCIP Service Codes */}
                        <section>
                            <SectionHeader
                                icon={ClipboardList}
                                label="Service Codes (AHCIP)"
                                isOpen={sections.ahcip}
                                onToggle={() => toggle('ahcip')}
                            />
                            {sections.ahcip && (
                                <div className="space-y-3">
                                    {ahcipCodes.length === 0 ? (
                                        <p className="text-[10px] text-white/30 px-1">No service code suggestions yet.</p>
                                    ) : (
                                        ahcipCodes.map((item) => (
                                            <div key={item.code} className="p-3 bg-white/5 border border-white/5 rounded-xl hover:border-blue-500/30 transition-colors">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="text-sm font-bold text-blue-400">{item.code}</div>
                                                    {item.aiConfidence != null && (
                                                        <span className="text-[10px] text-white/30 font-medium">
                                                            {Math.round(item.aiConfidence * 100)}%
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-white/60 leading-relaxed font-medium">
                                                    {item.description ?? "—"}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </section>

                        {/* Note Quality Score */}
                        <section>
                            <SectionHeader
                                icon={Sparkles}
                                label="Note Quality"
                                isOpen={sections.noteQuality}
                                onToggle={() => toggle('noteQuality')}
                            />
                            {sections.noteQuality && (
                                <div className="p-4 bg-gradient-to-br from-blue-600/10 to-indigo-600/10 border border-blue-500/20 rounded-2xl">
                                    {qualityScore != null ? (
                                        <>
                                            <div className="flex justify-between items-end mb-2">
                                                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">AI Acceptance Rate</span>
                                                <span className="text-2xl font-black text-white">{qualityScore}/100</span>
                                            </div>
                                            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                                    style={{ width: `${qualityScore}%` }}
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-[10px] text-white/30">No acceptance data yet.</p>
                                    )}
                                </div>
                            )}
                        </section>

                    </div>
                )}
            </div>
        </div>
    );
}
