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
                        className="flex flex-col p-5 bg-[#131929] border border-white/10 rounded-2xl hover:border-blue-500/30 hover:bg-[#161e33] transition-all group cursor-pointer"
                    >
                        {/* Card Header */}
                        <div className="flex items-center justify-between mb-5">
                            <div className="p-2 bg-blue-500/15 border border-blue-500/20 rounded-lg">
                                <User className="w-4 h-4 text-blue-400" />
                            </div>
                            <button className="text-white/20 hover:text-white/60 transition-colors">
                                <MoreHorizontal className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Patient ID */}
                        <div className="mb-4">
                            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Patient Pseudo</p>
                            <p className="text-base font-black text-white tracking-tight">{encounter.patient}</p>
                        </div>

                        {/* Specialty */}
                        <div className="mb-3">
                            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Specialty</p>
                            <p className="text-xs font-semibold text-white/80">{encounter.specialty}</p>
                        </div>

                        {/* Status */}
                        <div className="mb-5">
                            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1.5">Status</p>
                            <span className={`inline-flex text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                                encounter.status === 'Finalized'
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            }`}>
                                {encounter.status}
                            </span>
                        </div>

                        {/* Footer */}
                        <div className="mt-auto pt-4 border-t border-white/[0.07] flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-white/35">
                                <Calendar className="w-3 h-3" />
                                <span className="text-[10px] font-medium">{encounter.date}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-blue-400 group-hover:text-blue-300 transition-colors">
                                <FileText className="w-3 h-3" />
                                <span className="text-[10px] font-bold uppercase tracking-tight">View Note</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
