import { redirect } from "next/navigation";
import { getDbUser } from "@/lib/auth/get-db-user";
import { prisma } from "@/lib/db/client";
import { CollapsibleSidebar } from "@/components/layout/CollapsibleSidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const dbUser = await getDbUser();
  if (!dbUser) redirect("/onboarding");

  const practice = await prisma.practice.findUnique({
    where: { id: dbUser.practiceId },
    select: { active: true, stripeSubId: true },
  });

  // Subscription lapsed: redirect to recovery page so they can update payment via Stripe portal.
  // Only gate practices that completed checkout (stripeSubId set) — new/trial accounts are exempt.
  if (practice && !practice.active && practice.stripeSubId) {
    redirect("/subscription-required");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0b0d17] text-white">
      <CollapsibleSidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
