import React from 'react';
import { Clock, CheckCircle, Zap } from 'lucide-react';

interface ClinicalMetricsProps {
    metrics: {
        totalMinutesScribed: number;
        notesFinalizedToday: number;
        timeSavedHours: number;
    };
}

export function ClinicalMetrics({ metrics }: ClinicalMetricsProps) {
    const items = [
        {
            label: "Total Minutes Scribed",
            value: metrics.totalMinutesScribed.toLocaleString(),
            subtext: "This month",
            icon: Clock,
            gradient: "from-blue-600/20 to-indigo-600/20",
        },
        {
            label: "Notes Finalized Today",
            value: metrics.notesFinalizedToday.toLocaleString(),
            subtext: metrics.notesFinalizedToday > 0 ? "100% completion rate" : "No notes today",
            icon: CheckCircle,
            gradient: "from-emerald-600/20 to-teal-600/20",
        },
        {
            label: "Time Saved",
            value: metrics.timeSavedHours > 0 ? `${metrics.timeSavedHours} hrs` : "—",
            subtext: "Avg 10m/note vs 15m manual",
            icon: Zap,
            gradient: "from-amber-600/20 to-orange-600/20",
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {items.map((metric) => (
                <div
                    key={metric.label}
                    className={`relative overflow-hidden p-6 bg-white/[0.03] border border-white/10 rounded-2xl group hover:border-white/20 transition-all`}
                >
                    {/* Subtle Gradient Background */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${metric.gradient} opacity-50 group-hover:opacity-100 transition-opacity`} />

                    <div className="relative flex items-center gap-4">
                        <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                            <metric.icon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-white/40 uppercase tracking-wider">{metric.label}</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-white">{metric.value}</span>
                                <span className="text-[10px] text-white/40 font-medium">{metric.subtext}</span>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
