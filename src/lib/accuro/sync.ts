/**
 * Accuro appointment sync engine.
 * Mirrors src/lib/fhir/sync.ts but using the Accuro REST API.
 *
 * Strategy:
 *   1. Match our DB providers to Accuro providers by provincialRegistrationNumber
 *   2. For each matched provider, GET /appointments?providerId=&date=today
 *   3. Upsert patients + encounters
 *   4. Sync referral/PA statuses for all active patients
 */

import { prisma } from "@/lib/db/client";
import { encryptPHI } from "@/lib/db/encryption";
import { writeAuditLog } from "@/lib/db/audit";
import { logger } from "@/lib/utils/logger";
import { createAccuroClient, isAccuroConfigured } from "./accuro";
import {
    accuroPatientToInternal,
    accuroAppointmentToInternal,
    accuroReferralToInternal,
    accuroPhn,
} from "./mappers";
import type { Result } from "@/types/api";

export interface SyncResult {
    created: number;
    updated: number;
    skipped: number;
    paUpdated: number;
}

export async function syncTodaysAppointments(
    practiceId: string,
    triggeringUserId?: string
): Promise<Result<SyncResult>> {
    if (!isAccuroConfigured()) {
        return { success: false, error: "Accuro is not configured. Set ACCURO_* env vars." };
    }

    const practice = await prisma.practice.findFirst({
        where: { id: practiceId, deletedAt: null },
        select: { id: true, specialty: true },
    });
    if (!practice) return { success: false, error: "Practice not found" };

    const today = new Date().toISOString().slice(0, 10);
    let created = 0, updated = 0, skipped = 0, paUpdated = 0;

    try {
        const client = createAccuroClient();

        // ── 1. Get DB providers + match to Accuro by provincialRegistrationNumber ──
        const dbProviders = await prisma.user.findMany({
            where: {
                practiceId,
                role: "provider",
                active: true,
                deletedAt: null,
                provincialRegistrationNumber: { not: null },
            },
            select: { id: true, provincialRegistrationNumber: true },
        });

        if (dbProviders.length === 0) {
            return {
                success: false,
                error:
                    "No providers with provincial registration numbers configured. " +
                    "Add registration numbers to provider accounts under Settings → Users.",
            };
        }

        // ── 2. Fetch Accuro provider IDs for each DB provider ─────────────────────
        const accuroProviders = await client.listProviders();

        type ProviderMatch = { dbId: string; accuroProviderId: number };
        const matches: ProviderMatch[] = [];

        for (const dbProv of dbProviders) {
            const accuroProv = accuroProviders.find(
                (ap) => ap.registrationNumber === dbProv.provincialRegistrationNumber
            );
            if (accuroProv) {
                matches.push({ dbId: dbProv.id, accuroProviderId: accuroProv.providerId });
            } else {
                logger.info("Accuro sync: no matching Accuro provider for DB provider", {
                    practiceId,
                    registrationNumber: dbProv.provincialRegistrationNumber,
                });
            }
        }

        if (matches.length === 0) {
            return {
                success: false,
                error:
                    "None of your providers could be matched to Accuro providers by registration number. " +
                    "Ensure registration numbers in SpecScribe match exactly what is in Accuro.",
            };
        }

        // ── 3. Fetch appointments per provider + de-duplicate ────────────────────
        const seenIds = new Set<number>();
        type ApptWithProvider = {
            appt: Awaited<ReturnType<typeof client.getAppointmentsForDate>>[number];
            dbProviderId: string;
        };
        const appointments: ApptWithProvider[] = [];

        for (const match of matches) {
            const appts = await client.getAppointmentsForDate(today, match.accuroProviderId);
            logger.info("Accuro sync: fetched appointments", {
                practiceId,
                date: today,
                accuroProviderId: match.accuroProviderId,
                count: appts.length,
            });
            for (const appt of appts) {
                if (!seenIds.has(appt.appointmentId)) {
                    seenIds.add(appt.appointmentId);
                    appointments.push({ appt, dbProviderId: match.dbId });
                }
            }
        }

        logger.info("Accuro sync: total unique appointments", {
            practiceId,
            date: today,
            count: appointments.length,
        });

        // ── 4. Process appointments ───────────────────────────────────────────────
        for (const { appt, dbProviderId } of appointments) {
            if (!appt.patientId) { skipped++; continue; }

            // Fetch full patient
            let accuroPatient;
            try {
                accuroPatient = await client.getPatient(appt.patientId);
            } catch {
                logger.error("Accuro sync: failed to fetch patient", {
                    practiceId, accuroPatientId: appt.patientId,
                });
                skipped++;
                continue;
            }

            const pd = accuroPatientToInternal(accuroPatient);
            const phn = accuroPhn(accuroPatient);

            // Upsert patient
            const patient = await prisma.patient.upsert({
                where: { practiceId_fhirId: { practiceId, fhirId: pd.fhirId } },
                update: {
                    firstName: encryptPHI(pd.firstName),
                    lastName: encryptPHI(pd.lastName),
                    dob: encryptPHI(pd.dob),
                    sex: pd.sex ?? null,
                    phone: pd.phone ? encryptPHI(pd.phone) : null,
                    email: pd.email ? encryptPHI(pd.email) : null,
                },
                create: {
                    practiceId,
                    fhirId: pd.fhirId,
                    phn,
                    firstName: encryptPHI(pd.firstName),
                    lastName: encryptPHI(pd.lastName),
                    dob: encryptPHI(pd.dob),
                    sex: pd.sex ?? null,
                    phone: pd.phone ? encryptPHI(pd.phone) : null,
                    email: pd.email ? encryptPHI(pd.email) : null,
                },
            });

            await writeAuditLog({
                practiceId,
                userId: triggeringUserId,
                action: "CREATE",
                resource: "patient",
                resourceId: patient.id,
                fieldsChanged: ["firstName", "lastName", "dob", "phone", "email"],
                metadata: { source: "accuro_sync" },
            });

            // Upsert encounter
            const ad = accuroAppointmentToInternal(appt);
            const existing = await prisma.encounter.findFirst({
                where: { practiceId, fhirId: ad.fhirAppointmentId },
                select: { id: true },
            });

            if (existing) {
                await prisma.encounter.update({
                    where: { id: existing.id },
                    data: { encounterDate: ad.encounterDate },
                });
                updated++;
            } else {
                await prisma.encounter.create({
                    data: {
                        practiceId,
                        patientId: patient.id,
                        providerId: dbProviderId,
                        encounterDate: ad.encounterDate,
                        status: "not_started",
                        specialtyType: practice.specialty,
                        fhirId: ad.fhirAppointmentId,
                    },
                });
                created++;
            }
        }

        // ── 5. Sync PA status from Accuro referrals ───────────────────────────────
        paUpdated = await syncPriorAuthStatuses(practiceId, client, triggeringUserId);

        // ── 6. Update last sync timestamp ────────────────────────────────────────
        await prisma.practice.update({
            where: { id: practiceId },
            data: { ehrLastSyncAt: new Date() },
        });

        logger.info("Accuro sync complete", { practiceId, created, updated, skipped, paUpdated });
        return { success: true, data: { created, updated, skipped, paUpdated } };

    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error during Accuro sync";
        logger.error("Accuro sync failed", { practiceId, error: message });
        return { success: false, error: message };
    }
}

/**
 * Syncs PA status for all patients in the practice by reading Accuro referrals.
 * Returns count of PriorAuthRequest records updated.
 */
async function syncPriorAuthStatuses(
    practiceId: string,
    client: ReturnType<typeof createAccuroClient>,
    triggeringUserId?: string
): Promise<number> {
    let updated = 0;

    const openAuths = await prisma.priorAuthRequest.findMany({
        where: {
            practiceId,
            status: { in: ["pending_submission", "submitted", "under_review"] },
        },
        include: {
            encounter: { include: { patient: { select: { fhirId: true } } } },
        },
    });

    for (const auth of openAuths) {
        const fhirId = auth.encounter.patient.fhirId;
        if (!fhirId?.startsWith("accuro-")) continue;

        const accuroPatientId = parseInt(fhirId.replace("accuro-", ""), 10);
        if (isNaN(accuroPatientId)) continue;

        try {
            const referrals = await client.getReferrals(accuroPatientId);
            const referralDate = new Date(auth.submittedAt ?? auth.createdAt);

            for (const ref of referrals) {
                const internal = accuroReferralToInternal(ref, referralDate);

                // Simple match: same payer + status changed
                if (
                    internal.payerName === auth.payerName &&
                    internal.status !== auth.status
                ) {
                    await prisma.priorAuthRequest.update({
                        where: { id: auth.id },
                        data: {
                            status: internal.status as never,
                            authNumber: internal.authNumber ?? auth.authNumber,
                            approvedAt: internal.approvedAt,
                            expiresAt: internal.expiresAt,
                        },
                    });
                    logger.info("Accuro sync: PA status updated", {
                        practiceId,
                        priorAuthId: auth.id,
                        from: auth.status,
                        to: internal.status,
                    });
                    updated++;
                    break;
                }
            }
        } catch {
            logger.error("Accuro sync: failed to fetch referrals for patient", {
                practiceId, accuroPatientId,
            });
        }
    }

    return updated;
}
