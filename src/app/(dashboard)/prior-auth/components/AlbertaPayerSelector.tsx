"use client";

import { ChevronDown } from "lucide-react";
import { ALBERTA_PAYER_CONFIG, type AlbertaPayerPreset, type PayerSpecificData } from "@/types/prior-auth";

interface AlbertaPayerSelectorProps {
  selected: AlbertaPayerPreset | "";
  payerData: PayerSpecificData;
  onPayerChange: (preset: AlbertaPayerPreset) => void;
  onPayerDataChange: (data: PayerSpecificData) => void;
}

const PAYER_OPTIONS: { value: AlbertaPayerPreset; label: string; tag: string }[] = [
  { value: "abc", label: "Alberta Blue Cross", tag: "Gov / Employer" },
  { value: "sunlife", label: "Sun Life Financial", tag: "Private Group" },
  { value: "ahs_special_auth", label: "AHS Special Authorization", tag: "High-Cost Drug" },
];

function Field({
  label,
  id,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/50 transition-colors"
      />
    </div>
  );
}

export function AlbertaPayerSelector({
  selected,
  payerData,
  onPayerChange,
  onPayerDataChange,
}: AlbertaPayerSelectorProps) {
  function update(patch: Partial<PayerSpecificData>) {
    onPayerDataChange({ ...payerData, ...patch });
  }

  return (
    <div className="space-y-4">
      {/* Payer dropdown */}
      <div>
        <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">
          Alberta Payer
        </label>
        <div className="relative">
          <select
            value={selected}
            onChange={(e) => onPayerChange(e.target.value as AlbertaPayerPreset)}
            className="w-full appearance-none bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 transition-colors cursor-pointer pr-8"
          >
            <option value="" disabled className="bg-[#0E1521]">
              Select payer…
            </option>
            {PAYER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#0E1521]">
                {opt.label} — {opt.tag}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
        </div>
        {selected && (
          <p className="mt-1.5 text-[11px] text-white/30 leading-tight">
            {ALBERTA_PAYER_CONFIG[selected].description}
          </p>
        )}
      </div>

      {/* Dynamic fields: Alberta Blue Cross */}
      {selected === "abc" && (
        <div className="grid grid-cols-2 gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
          <Field
            label="AHCIP Physician ID"
            id="ahcipPhysicianId"
            value={payerData.ahcipPhysicianId ?? ""}
            onChange={(v) => update({ ahcipPhysicianId: v })}
            placeholder="e.g. 12345"
          />
          <Field
            label="Special Authorization Form #"
            id="specialAuthFormNumber"
            value={payerData.specialAuthFormNumber ?? ""}
            onChange={(v) => update({ specialAuthFormNumber: v })}
            placeholder="e.g. ABC-SA-001"
          />
        </div>
      )}

      {/* Dynamic fields: Sun Life */}
      {selected === "sunlife" && (
        <div className="grid grid-cols-2 gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
          <Field
            label="Group Plan Number"
            id="groupPlanNumber"
            value={payerData.groupPlanNumber ?? ""}
            onChange={(v) => update({ groupPlanNumber: v })}
            placeholder="e.g. GRP-98765"
          />
          <Field
            label="Member Certificate ID"
            id="memberCertificateId"
            value={payerData.memberCertificateId ?? ""}
            onChange={(v) => update({ memberCertificateId: v })}
            placeholder="e.g. 00123456"
          />
        </div>
      )}

      {/* Dynamic fields: AHS Special Authorization */}
      {selected === "ahs_special_auth" && (
        <div className="space-y-3 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="AHS Provider Number"
              id="ahsProviderNumber"
              value={payerData.ahsProviderNumber ?? ""}
              onChange={(v) => update({ ahsProviderNumber: v })}
              placeholder="e.g. AHS-12345"
            />
            <Field
              label="Special Authorization Form #"
              id="specialAuthFormNumber"
              value={payerData.specialAuthFormNumber ?? ""}
              onChange={(v) => update({ specialAuthFormNumber: v })}
              placeholder="e.g. AHS-SA-002"
            />
          </div>
          {/* AISH toggle */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={payerData.aishStatus ?? false}
                onChange={(e) => update({ aishStatus: e.target.checked })}
                className="sr-only"
              />
              <div className={`w-10 h-5 rounded-full transition-colors ${payerData.aishStatus ? "bg-blue-600" : "bg-white/10"}`} />
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${payerData.aishStatus ? "translate-x-5" : ""}`} />
            </div>
            <div>
              <div className="text-xs font-bold text-white/70 group-hover:text-white transition-colors">
                AISH Recipient
              </div>
              <div className="text-[10px] text-white/30">
                Assured Income for the Severely Handicapped — triggers additional employment documentation
              </div>
            </div>
          </label>
        </div>
      )}
    </div>
  );
}
