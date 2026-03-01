import React from 'react';
import { Search, Filter, MoreHorizontal, User, FileText, Calendar, Activity } from 'lucide-react';

const encounters = [
    { id: "PX-7429", date: "2026-02-26", specialty: "Orthopedics", status: "Finalized", patient: "JD-9921" },
    { id: "PX-8102", date: "2026-02-26", specialty: "Neurology", status: "Draft", patient: "ML-3342" },
    { id: "PX-9937", date: "2026-02-25", specialty: "Behavioral Health", status: "Finalized", patient: "AR-1288" },
    { id: "PX-1145", date: "2026-02-25", specialty: "Internal Medicine", status: "Draft", patient: "KB-4432" },
];

export function EncounterList() {
    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-white">Recent Patient Encounters</h2>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                            type="text"
                            placeholder="Search pseudonym..."
                            className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all w-64"
                        />
                    </div>
                    <button className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                        <Filter className="w-4 h-4 text-white/60" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {encounters.map((encounter) => (
                    <div
                        key={encounter.id}
                        className="p-5 bg-white/[0.03] border border-white/10 rounded-2xl hover:border-white/20 hover:bg-white/[0.05] transition-all group"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                                <User className="w-4 h-4 text-blue-400" />
                            </div>
                            <button className="text-white/20 hover:text-white/60 transition-colors">
                                <MoreHorizontal className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Patient Pseudo</p>
                                <p className="text-sm font-bold text-white">{encounter.patient}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <p className="text-[10px] font-medium text-white/30 uppercase tracking-widest mb-1">Specialty</p>
                                    <p className="text-xs text-white/80">{encounter.specialty}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-medium text-white/30 uppercase tracking-widest mb-1">Status</p>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${encounter.status === 'Finalized'
                                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                            : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                        }`}>
                                        {encounter.status}
                                    </span>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-white/40">
                                    <Calendar className="w-3 h-3" />
                                    <span className="text-[10px] font-medium">{encounter.date}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-blue-400">
                                    <FileText className="w-3 h-3" />
                                    <span className="text-[10px] font-bold uppercase tracking-tight">View Note</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
