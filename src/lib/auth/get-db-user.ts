import { currentUser, clerkClient } from "@clerk/nextjs/server";
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
 *
 * Also lazily syncs the DB role to Clerk publicMetadata so the sidebar
 * admin gate (publicMetadata.role) stays accurate without a separate webhook.
 * The Clerk API is only called when the role is missing or stale.
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

  if (!user) return null;

  // Lazy-sync DB role → Clerk publicMetadata so sidebar admin gating works.
  // Only calls the Clerk API when the cached role is missing or stale — typically
  // once per user on first sign-in, or once after an admin changes their role.
  if (clerkUser.publicMetadata?.role !== user.role) {
    try {
      const clerk = await clerkClient();
      await clerk.users.updateUser(clerkUser.id, {
        publicMetadata: { ...clerkUser.publicMetadata, role: user.role },
      });
    } catch {
      // Non-fatal: sidebar falls back gracefully; sync retried on next request.
    }
  }

  return user;
}
