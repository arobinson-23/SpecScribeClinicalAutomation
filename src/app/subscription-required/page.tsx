import { redirect } from "next/navigation";
import { getDbUser } from "@/lib/auth/get-db-user";
import { prisma } from "@/lib/db/client";
import { createBillingPortalSession } from "@/lib/billing/stripe";
import { LogoIcon } from "@/components/ui/LogoIcon";
import { CreditCard, AlertTriangle } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Subscription Required — SpecScribe" };

export default async function SubscriptionRequiredPage() {
  const dbUser = await getDbUser();
  if (!dbUser) redirect("/sign-in");

  const practice = await prisma.practice.findUnique({
    where: { id: dbUser.practiceId },
    select: { active: true, stripeSubId: true, stripeCustomerId: true, name: true },
  });

  // Active practice — they shouldn't be here
  if (!practice || practice.active) redirect("/dashboard");

  async function openBillingPortal() {
    "use server";
    if (!practice?.stripeCustomerId) return;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const url = await createBillingPortalSession({
      customerId: practice.stripeCustomerId,
      returnUrl: `${appUrl}/dashboard`,
    });
    redirect(url);
  }

  return (
    <div className="min-h-screen bg-[#0b0d17] text-white flex flex-col items-center justify-center px-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-600/5 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-md z-10">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="p-2 bg-blue-600/10 border border-blue-500/20 rounded-xl">
            <LogoIcon className="w-7 h-7 text-blue-400" />
          </div>
          <div>
            <div className="text-lg font-black text-white tracking-tight leading-none">SpecScribe</div>
            <div className="text-[9px] font-bold text-blue-400/60 uppercase tracking-[0.2em]">Clinical AI</div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/[0.03] border border-red-500/20 rounded-2xl p-8 shadow-2xl text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
              <AlertTriangle className="w-7 h-7 text-red-400" />
            </div>
          </div>

          <h1 className="text-xl font-bold text-white mb-2">Subscription Inactive</h1>
          <p className="text-sm text-white/50 mb-2">
            Access to <span className="text-white/70 font-medium">{practice.name}</span> has been paused
            because a recent payment could not be processed.
          </p>
          <p className="text-sm text-white/40 mb-7">
            Update your payment method to restore full access immediately. Your data is safe and nothing has been deleted.
          </p>

          <form action={openBillingPortal}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 mb-3"
            >
              <CreditCard className="w-4 h-4" />
              Update Payment Method
            </button>
          </form>

          <p className="text-[11px] text-white/30">
            Questions?{" "}
            <a href="mailto:support@specscribe.ca" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
              Contact support
            </a>
          </p>
        </div>

        <p className="mt-6 text-center text-[11px] text-white/25">
          <Link href="/sign-in" className="hover:text-white/50 transition-colors">
            Sign in with a different account
          </Link>
        </p>
      </div>
    </div>
  );
}
