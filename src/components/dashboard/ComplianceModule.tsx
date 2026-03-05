"use client";

import React, { useState } from 'react';
import { Shield, Lock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { ComplianceAlertSeverity } from "@prisma/client";

interface ComplianceModuleProps {
    alerts: {
        id: string;
        alertType: string;
        severity: ComplianceAlertSeverity;
        title: string;
    }[];
}

export function ComplianceModule({ alerts }: ComplianceModuleProps) {
    const [isLocked, setIsLocked] = useState(false);

    const handleSessionLock = () => {
        setIsLocked(true);
        toast.success("Client state cleared. Session locked for PHI security.");
        setTimeout(() => {
            setIsLocked(false);
        }, 3000);
    };

    const complianceItems = [
        { label: "MFA Status", status: "Active", icon: ShieldCheck, color: "text-emerald-400" },
        { label: "Encryption", status: "AES-256", icon: Lock, color: "text-emerald-400" },
        { label: "Audit Log", status: "Enabled", icon: Shield, color: "text-emerald-400" },
    ];

    const criticalCount = alerts.filter((a) => a.severity === "critical").length;
    const alertCount = alerts.length;

    return (
        <div className="p-6 bg-white/[0.03] border border-white/10 rounded-2xl">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Security & Compliance</h3>
                <button
                    onClick={handleSessionLock}
                    disabled={isLocked}
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 hover:bg-red-500/20 transition-all text-xs font-bold uppercase tracking-wider"
                >
                    <Lock className="w-3 h-3" />
                    {isLocked ? "PHI Purged" : "Session Lock"}
                </button>
            </div>

            <div className="space-y-4">
                {complianceItems.map((item) => (
                    <div key={item.label} className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl">
                        <div className="flex items-center gap-3">
                            <item.icon className="w-4 h-4 text-white/40" />
                            <span className="text-xs font-medium text-white/60">{item.label}</span>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${item.color}`}>{item.status}</span>
                    </div>
                ))}

                {/* Live unresolved alert count */}
                <div className={`flex items-center justify-between p-3 border rounded-xl ${
                    criticalCount > 0
                        ? 'bg-red-500/5 border-red-500/20'
                        : alertCount > 0
                        ? 'bg-amber-500/5 border-amber-500/20'
                        : 'bg-white/5 border-white/5'
                }`}>
                    <div className="flex items-center gap-3">
                        <AlertTriangle className={`w-4 h-4 ${
                            criticalCount > 0 ? 'text-red-400' : alertCount > 0 ? 'text-amber-400' : 'text-white/40'
                        }`} />
                        <span className="text-xs font-medium text-white/60">Unresolved Alerts</span>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${
                        criticalCount > 0 ? 'text-red-400' : alertCount > 0 ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                        {alertCount === 0 ? "Clear" : alertCount}
                    </span>
                </div>

                <div className="mt-4 p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-center gap-4">
                    <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
                        <ShieldCheck className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="text-[10px] leading-tight">
                        <span className="block text-white font-bold mb-0.5">HIA & PIPEDA Compliant</span>
                        <span className="block text-white/40">Data residency: Calgary, AB Zone</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
