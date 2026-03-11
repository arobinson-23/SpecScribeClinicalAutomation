import { redirect } from "next/navigation";
import { getDbUser } from "@/lib/auth/get-db-user";
import { currentUser } from "@clerk/nextjs/server";
import { OnboardingWizard } from "./OnboardingWizard";

export const metadata = { title: "Set Up Your Practice — SpecScribe" };

export default async function OnboardingPage() {
  // Redirect already-onboarded users to the dashboard
  const dbUser = await getDbUser();
  if (dbUser) redirect("/dashboard");

  // We need the Clerk email to pre-fill and pass to the wizard
  const clerkUser = await currentUser();
  if (!clerkUser) redirect("/sign-in");

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";

  return <OnboardingWizard clerkEmail={email} />;
}
