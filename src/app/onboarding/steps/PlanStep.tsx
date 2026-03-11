"use client";

import { Check } from "lucide-react";

export type PlanTier = "basic" | "professional";

const PLANS: {
  tier: PlanTier;
  name: string;
  pricePerProvider: number;
  features: string[];
  highlight?: boolean;
}[] = [
  {
    tier: "basic",
    name: "Basic",
    pricePerProvider: 800,
    features: [
      "AI clinical note generation (SOAP / DAP / BIRP)",
      "CPT & ICD-10-CA coding suggestions with confidence scores",
      "Encounter documentation & review queue",
      "Audit-ready compliance reports",
      "PIPEDA / HIA compliant data residency (ca-central-1)",
      "Up to 5 providers",
    ],
  },
  {
    tier: "professional",
    name: "Professional",
    pricePerProvider: 1200,
    highlight: true,
    features: [
      "Everything in Basic",
      "Prior authorization wizard (Alberta Health / Blue Cross)",
      "Denial prevention engine with payer-specific rules",
      "FHIR R4 EHR integration (Epic, Accuro, MEDITECH)",
      "Advanced analytics & provider benchmarking",
      "Unlimited providers",
      "Dedicated onboarding support",
    ],
  },
];

const label = "block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider";

type Props = {
  selected: PlanTier;
  providerCount: number;
  onChange: (tier: PlanTier) => void;
};

export function PlanStep({ selected, providerCount, onChange }: Props) {
  const count = Math.max(1, providerCount || 1);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PLANS.map((plan) => {
          const isActive = selected === plan.tier;
          const monthly = plan.pricePerProvider * count;

          return (
            <button
              key={plan.tier}
              type="button"
              onClick={() => onChange(plan.tier)}
              className={[
                "text-left rounded-2xl border p-5 transition-all duration-200",
                isActive
                  ? "border-blue-500/60 bg-blue-600/10 shadow-lg shadow-blue-600/10"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]",
              ].join(" ")}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-sm font-bold text-white">{plan.name}</span>
                  {plan.highlight && (
                    <span className="ml-2 text-[10px] font-bold bg-blue-600/30 text-blue-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Popular
                    </span>
                  )}
                </div>
                <div
                  className={[
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                    isActive ? "border-blue-500 bg-blue-500" : "border-white/20",
                  ].join(" ")}
                >
                  {isActive && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
              </div>

              <div className="mb-4">
                <span className="text-2xl font-black text-white">${plan.pricePerProvider.toLocaleString()}</span>
                <span className="text-sm text-white/40">/provider/mo</span>
                {count > 1 && (
                  <div className="mt-0.5 text-xs text-white/40">
                    = ${monthly.toLocaleString()} CAD/mo for {count} providers
                  </div>
                )}
              </div>

              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-white/60 leading-snug">{f}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-xs text-white/40">
        <span className="text-white/60 font-semibold">14-day free trial</span> — no credit card charge until your trial ends.
        Cancel anytime. All plans billed monthly in CAD. Prices exclude applicable taxes.
      </div>

      <div>
        <label className={label}>Enterprise</label>
        <p className="text-sm text-white/40">
          20+ providers, custom EHR integrations, or revenue-share pricing?{" "}
          <a href="mailto:sales@specscribe.ca" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
            Contact sales
          </a>
        </p>
      </div>
    </div>
  );
}
