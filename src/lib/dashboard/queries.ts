import { prisma } from "@/lib/db/client";

export async function getDashboardMetrics(practiceId: string) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [audioAgg, notesFinalizedToday] = await Promise.all([
    prisma.encounter.aggregate({
      where: { practiceId, deletedAt: null, encounterDate: { gte: monthStart } },
      _sum: { audioDuration: true },
    }),
    prisma.encounterNote.count({
      where: {
        encounter: { practiceId, deletedAt: null },
        finalizedAt: { gte: todayStart },
      },
    }),
  ]);

  const totalMinutesScribed = Math.round((audioAgg._sum.audioDuration ?? 0) / 60);
  // Industry avg 15 min/note, SpecScribe targets <5 min review → 10 min saved per note
  const timeSavedHours = Math.round(((notesFinalizedToday * 10) / 60) * 10) / 10;

  return { totalMinutesScribed, notesFinalizedToday, timeSavedHours };
}

export async function getRecentEncounters(practiceId: string) {
  return prisma.encounter.findMany({
    where: { practiceId, deletedAt: null },
    select: {
      id: true,
      encounterDate: true,
      specialtyType: true,
      status: true,
      patient: { select: { phn: true } },
      notes: {
        select: { finalizedAt: true },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { encounterDate: "desc" },
    take: 10,
  });
}

export async function getComplianceAlerts(practiceId: string) {
  return prisma.complianceAlert.findMany({
    where: { practiceId, resolvedAt: null },
    select: { id: true, alertType: true, severity: true, title: true },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: 5,
  });
}

export async function getLatestPendingEncounterCodes(practiceId: string) {
  const encounter = await prisma.encounter.findFirst({
    where: {
      practiceId,
      deletedAt: null,
      status: { in: ["needs_review", "ai_processing"] },
    },
    select: {
      id: true,
      codes: {
        where: { providerAccepted: null },
        select: { code: true, codeType: true, description: true, aiConfidence: true },
        take: 5,
      },
      notes: {
        select: { aiAcceptanceRate: true },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { encounterDate: "desc" },
  });

  if (!encounter) return null;

  return {
    encounterId: encounter.id,
    codes: encounter.codes,
    aiAcceptanceRate: encounter.notes[0]?.aiAcceptanceRate ?? null,
  };
}
