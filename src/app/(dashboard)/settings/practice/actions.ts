"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { PracticeSettingsSchema, type PracticeSettings } from "./settings-schema";

export async function updatePracticeSettings(
  data: PracticeSettings
): Promise<{ success: true } | { success: false; error: string }> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { success: false, error: "Unauthorized" };

  const parsed = PracticeSettingsSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: "Invalid settings data" };

  // Provider approval is non-negotiable — always enforce it regardless of UI
  const safeData: PracticeSettings = { ...parsed.data, requireProviderApproval: true };

  const dbUser = await prisma.user.findFirst({
    where: { active: true },
    select: { practiceId: true },
  });

  if (!dbUser?.practiceId) return { success: false, error: "No practice found" };

  await prisma.practice.update({
    where: { id: dbUser.practiceId },
    data: { settings: safeData },
  });

  revalidatePath("/settings/practice");
  return { success: true };
}
