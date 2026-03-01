import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/client";
import { createBillingPortalSession } from "@/lib/billing/stripe";
import { redirect } from "next/navigation";

export default async function BillingSettingsPage() {
  const session = await getServerSession(authOptions);
  const practiceId = (session as unknown as { practiceId: string })?.practiceId;

  const practice = await prisma.practice.findUnique({
    where: { id: practiceId },
    select: { stripeCustomerId: true, subscriptionTier: true, name: true },
  });

  const TIER_DETAILS = {
    basic: {
      name: "Basic",
      price: "$800/provider/month",
      features: [
        "Audio transcription",
        "AI note generation",
        "CPT & ICD-10 coding suggestions",
        "Prior auth tracking",
        "Basic compliance dashboard",
        "Up to 5 providers",
      ],
    },
    professional: {
      name: "Professional",
      price: "$1,200/provider/month",
      features: [
        "Everything in Basic",
        "Denial prevention engine",
        "Prior auth automation (AI-generated PA letters)",
        "FHIR R4 EHR integration",
        "Advanced analytics",
        "Unlimited providers",
      ],
    },
    enterprise: {
      name: "Enterprise",
      price: "Custom pricing",
      features: [
        "Everything in Professional",
        "Revenue-share on recovered claims",
        "Dedicated success manager",
        "Custom specialty templates",
        "HL7v2 integration",
        "SOC 2 reports on request",
        "BAA with 24h SLA",
      ],
    },
  };

  const currentTier = practice?.subscriptionTier ?? "basic";
  const tierDetails = TIER_DETAILS[currentTier];

  async function openPortal() {
    "use server";
    if (!practice?.stripeCustomerId) return;
    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/settings/billing`;
    const url = await createBillingPortalSession({ customerId: practice.stripeCustomerId, returnUrl });
    redirect(url);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Billing & Subscription</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage your plan, invoices, and payment methods</p>
      </div>

      {/* Current plan */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-4">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 text-sm">Current Plan</h2>
          <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">
            {tierDetails.name}
          </span>
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-semibold text-slate-900 text-lg mb-1">{tierDetails.name} Plan</div>
              <div className="text-slate-500 text-sm">{tierDetails.price}</div>
              <ul className="mt-3 space-y-1">
                {tierDetails.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="text-green-500">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            {practice?.stripeCustomerId && (
              <form action={openPortal}>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                >
                  Manage in Stripe →
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Upgrade options */}
      {currentTier !== "enterprise" && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="font-semibold text-slate-900 text-sm">Upgrade Your Plan</h2>
          </div>
          <div className="p-5 grid grid-cols-2 gap-4">
            {currentTier === "basic" && (
              <div className="border border-blue-200 rounded-xl p-4 bg-blue-50">
                <div className="font-semibold text-slate-900 mb-1">Professional</div>
                <div className="text-blue-600 text-sm font-medium mb-2">$1,200/provider/month</div>
                <p className="text-xs text-slate-500 mb-3">
                  Add denial prevention, FHIR EHR integration, and advanced analytics.
                </p>
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-2 rounded-lg transition-colors">
                  Upgrade to Professional
                </button>
              </div>
            )}
            <div className="border border-slate-200 rounded-xl p-4">
              <div className="font-semibold text-slate-900 mb-1">Enterprise</div>
              <div className="text-slate-600 text-sm font-medium mb-2">Custom pricing</div>
              <p className="text-xs text-slate-500 mb-3">
                Revenue-share model, dedicated support, custom integrations.
              </p>
              <button className="w-full border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium py-2 rounded-lg transition-colors">
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
