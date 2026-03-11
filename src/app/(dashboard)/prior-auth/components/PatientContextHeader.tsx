"use client";

import { User, Calendar, CreditCard, ShieldCheck } from "lucide-react";
import type { EncounterContext } from "@/types/prior-auth";

interface PatientContextHeaderProps {
  context: EncounterContext;
}

function formatDOB(dob: string | null): string {
  if (!dob) return "Not on file";
  try {
    const d = new Date(dob);
    return d.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return dob;
  }
}

function formatPHN(phn: string | null): string {
  if (!phn) return "Not on file";
  const digits = phn.replace(/\D/g, "");
  if (digits.length === 9) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return phn;
}

export function PatientContextHeader({ context }: PatientContextHeaderProps) {
  return (
    <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400">
          Patient Context — Auto-populated from Supabase
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 p-1.5 bg-white/5 rounded-lg">
            <User className="h-3.5 w-3.5 text-white/40" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-0.5">
              Legal Name
            </div>
            <div className="text-sm font-bold text-white">{context.patientName}</div>
            {context.phn && (
              <div className="text-[10px] font-mono text-white/30 mt-0.5">PHN: {context.phn}</div>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 p-1.5 bg-white/5 rounded-lg">
            <Calendar className="h-3.5 w-3.5 text-white/40" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-0.5">
              Date of Birth
            </div>
            <div className="text-sm font-semibold text-white/80">{formatDOB(context.dob)}</div>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 p-1.5 bg-white/5 rounded-lg">
            <CreditCard className="h-3.5 w-3.5 text-white/40" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-0.5">
              PHN / ULI (Alberta)
            </div>
            <div className="text-sm font-mono font-semibold text-white/80">
              {formatPHN(context.phn)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
