import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { MfaVerifyClient } from "./MfaVerifyClient";

interface Props {
  searchParams: Promise<{ redirect?: string }>;
}

export default async function MfaVerifyPage({ searchParams }: Props) {
  const clerkUser = await currentUser();
  if (!clerkUser) redirect("/sign-in");

  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) redirect("/sign-in");

  // Look up the DB user to determine MFA state. Do NOT send any PHI to the client.
  const dbUser = await prisma.user.findFirst({
    where: { email, active: true, deletedAt: null },
    select: { mfaEnabled: true },
  });

  const { redirect: redirectTo = "/dashboard" } = await searchParams;

  return (
    <MfaVerifyClient
      mfaEnabled={dbUser?.mfaEnabled ?? false}
      redirectTo={redirectTo}
    />
  );
}
