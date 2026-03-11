"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { PracticeStep, type PracticeFormData } from "./steps/PracticeStep";
import { ProfileStep, type ProfileFormData } from "./steps/ProfileStep";
import { PlanStep, type PlanTier } from "./steps/PlanStep";

const STEPS = ["Practice Info", "Your Profile", "Choose Plan"];

type Props = { clerkEmail: string };

export function OnboardingWizard({ clerkEmail }: Props) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [practice, setPractice] = useState<PracticeFormData>({
    name: "", phone: "", street: "", city: "", province: "AB", postalCode: "",
    businessNumber: "", registrationNumber: "",
  });

  const [profile, setProfile] = useState<ProfileFormData>({
    firstName: "", lastName: "", profession: "", credentials: "",
    registrationNumber: "", practitionerId: "", providerCount: "1",
  });

  const [selectedTier, setSelectedTier] = useState<PlanTier>("professional");

  function setPracticeField(key: keyof PracticeFormData, value: string) {
    setPractice((p) => ({ ...p, [key]: value }));
  }
  function setProfileField(key: keyof ProfileFormData, value: string) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  function validateStep(): string | null {
    if (step === 0) {
      if (!practice.name.trim()) return "Practice name is required.";
      if (!practice.phone.trim()) return "Phone number is required.";
      if (!practice.city.trim()) return "City is required.";
      if (!practice.street.trim()) return "Street address is required.";
      if (!practice.postalCode.trim()) return "Postal code is required.";
    }
    if (step === 1) {
      if (!profile.firstName.trim()) return "First name is required.";
      if (!profile.lastName.trim()) return "Last name is required.";
      if (!profile.profession) return "Please select your profession.";
      if (!profile.providerCount || Number(profile.providerCount) < 1) return "Provider count must be at least 1.";
    }
    return null;
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    const err = validateStep();
    if (err) { setError(err); return; }
    setError(null);
    setStep((s) => s + 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Create Practice + User
      const setupRes = await fetch("/api/onboarding/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ practice, profile }),
      });
      const setupJson = await setupRes.json() as { data?: { practiceId: string }; error?: string };
      if (!setupRes.ok || !setupJson.data) {
        setError(setupJson.error ?? "Setup failed. Please try again.");
        return;
      }

      // 2. Create Stripe Checkout Session
      const checkoutRes = await fetch("/api/onboarding/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practiceId: setupJson.data.practiceId,
          tier: selectedTier,
          providerCount: Number(profile.providerCount),
        }),
      });
      const checkoutJson = await checkoutRes.json() as { data?: { url: string }; error?: string };
      if (!checkoutRes.ok || !checkoutJson.data?.url) {
        setError(checkoutJson.error ?? "Could not start checkout. Please try again.");
        return;
      }

      window.location.href = checkoutJson.data.url;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const providerCount = Number(profile.providerCount) || 1;
  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="flex justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        {/* Stepper */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((name, i) => (
            <div key={name} className="flex items-center gap-2 flex-1">
              <div className={[
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border flex-shrink-0",
                i < step ? "bg-blue-600 border-blue-600 text-white" :
                i === step ? "border-blue-500 text-blue-400 bg-blue-500/10" :
                "border-white/15 text-white/25",
              ].join(" ")}>
                {i < step ? "✓" : i + 1}
              </div>
              <span className={`text-xs font-semibold hidden sm:block ${i === step ? "text-white/80" : "text-white/25"}`}>{name}</span>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < step ? "bg-blue-600/40" : "bg-white/8"}`} />}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-7 shadow-2xl">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-white">{STEPS[step]}</h1>
            <p className="text-sm text-white/40 mt-1">
              {step === 0 && "Tell us about your clinic or practice."}
              {step === 1 && "Set up your practitioner profile for documentation and compliance."}
              {step === 2 && "Select a subscription plan. Your 14-day free trial starts today."}
            </p>
          </div>

          <form onSubmit={isLastStep ? handleSubmit : handleNext} noValidate>
            {step === 0 && <PracticeStep form={practice} onChange={setPracticeField} />}
            {step === 1 && <ProfileStep form={profile} email={clerkEmail} onChange={setProfileField} />}
            {step === 2 && <PlanStep selected={selectedTier} providerCount={providerCount} onChange={setSelectedTier} />}

            {error && (
              <p className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex items-center justify-between mt-7 pt-5 border-t border-white/8">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => { setError(null); setStep((s) => s - 1); }}
                  className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
              ) : <div />}

              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-600/20"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isLastStep ? "Proceed to Payment" : "Continue"}
                {!isLastStep && !loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </form>
        </div>

        {/* Trust badge */}
        <div className="mt-5 flex items-center gap-3 py-3 px-4 bg-white/5 border border-white/8 rounded-xl">
          <ShieldCheck className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <p className="text-[11px] text-white/40 leading-tight">
            All data stored in Canada (ca-central-1). PIPEDA & HIA compliant. 256-bit encryption.
          </p>
        </div>
      </div>
    </div>
  );
}
