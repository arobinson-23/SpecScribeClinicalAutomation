import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/client";
import type { UserRole } from "@prisma/client";

export type DbUser = {
  id: string;
  practiceId: string;
  role: UserRole;
  email: string;
};

/**
 * Resolves the authenticated Clerk session to the matching Prisma DB user.
 * Uses the Clerk session's primary email address as the link key.
 * Returns null if the user is unauthenticated or has no matching active DB record.
 */
export async function getDbUser(): Promise<DbUser | null> {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) return null;

  const user = await prisma.user.findFirst({
    where: { email, active: true, deletedAt: null },
    select: { id: true, practiceId: true, role: true, email: true },
  });

  return user;
}
