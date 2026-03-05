/**
 * EHR appointment auto-sync.
 * Fetches today's appointments from the practice's EHR (Epic),
 * upserts patients and encounters into SpecScribe, and updates ehrLastSyncAt.
 *
 * PHI rules:
 *   - All patient PHI fields are encrypted with encryptPHI() before DB write
 *   - Every PHI read/write is logged via writeAuditLog()
 *   - No PHI values are logged — field names only
 */

import { prisma } from "@/lib/db/client";
import { encryptPHI } from "@/lib/db/encryption";
import { writeAuditLog } from "@/lib/db/audit";
import { logger } from "@/lib/utils/logger";
import { createEpicClient, isEpicConfigured } from "./epic";
import { fhirPatientToInternal, fhirAppointmentToInternal } from "./mappers";
import type { Result } from "@/types/api";

export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
}

/**
 * Sync today's appointments from the practice's configured EHR.
 * Creates or updates Patient and Encounter records.
 * Returns a Result with counts of created/updated/skipped encounters.
 */
export async function syncTodaysAppointments(
  practiceId: string,
  triggeringUserId?: string
): Promise<Result<SyncResult>> {
  if (!isEpicConfigured()) {
    return { success: false, error: "EHR is not configured for this deployment" };
  }

  const practice = await prisma.practice.findFirst({
    where: { id: practiceId, deletedAt: null },
    select: { id: true, ehrType: true, specialty: true },
  });

  if (!practice) {
    return { success: false, error: "Practice not found" };
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  let created = 0;
  let updated = 0;
  let skipped = 0;

  try {
    const client = createEpicClient();
    const bundle = await client.getAppointmentsForDate(today);
    const appointments = bundle.entry?.map((e) => e.resource) ?? [];

    logger.info("EHR sync: fetched appointments", {
      practiceId,
      date: today,
      count: appointments.length,
    });

    for (const fhirAppt of appointments) {
      if (!fhirAppt.id) {
        skipped++;
        continue;
      }

      const appt = fhirAppointmentToInternal(fhirAppt);

      if (!appt.patientFhirId) {
        skipped++;
        continue;
      }

      // ── 1. Fetch full patient resource ──────────────────────────────────────
      let fhirPatient;
      try {
        fhirPatient = await client.getPatient(appt.patientFhirId);
      } catch (err) {
        logger.error("EHR sync: failed to fetch patient", {
          practiceId,
          fhirAppointmentId: fhirAppt.id,
        });
        skipped++;
        continue;
      }

      const patientData = fhirPatientToInternal(fhirPatient);

      // ── 2. Upsert patient (encrypt all PHI fields before write) ─────────────
      const mrn = fhirPatient.identifier?.find((i) =>
        i.system?.includes("MR") || i.system?.includes("mrn")
      )?.value ?? `FHIR-${patientData.fhirId}`;

      const patient = await prisma.patient.upsert({
        where: {
          practiceId_fhirId: {
            practiceId,
            fhirId: patientData.fhirId,
          },
        },
        update: {
          firstName: encryptPHI(patientData.firstName),
          lastName: encryptPHI(patientData.lastName),
          dob: encryptPHI(patientData.dob),
          sex: patientData.sex ?? null,
          phone: patientData.phone ? encryptPHI(patientData.phone) : null,
          email: patientData.email ? encryptPHI(patientData.email) : null,
        },
        create: {
          practiceId,
          fhirId: patientData.fhirId,
          mrn: encryptPHI(mrn),
          firstName: encryptPHI(patientData.firstName),
          lastName: encryptPHI(patientData.lastName),
          dob: encryptPHI(patientData.dob),
          sex: patientData.sex ?? null,
          phone: patientData.phone ? encryptPHI(patientData.phone) : null,
          email: patientData.email ? encryptPHI(patientData.email) : null,
        },
      });

      await writeAuditLog({
        practiceId,
        userId: triggeringUserId,
        action: "CREATE",
        resource: "patient",
        resourceId: patient.id,
        fieldsChanged: ["firstName", "lastName", "dob", "phone", "email"],
        metadata: { source: "ehr_sync", ehrType: "epic" },
      });

      // ── 3. Upsert encounter (keyed on fhirId = FHIR Appointment ID) ──────────
      // Find the provider by NPI or fhirId — fall back to the first provider in the practice
      const providerNpi = appt.providerFhirId;
      const provider = await prisma.user.findFirst({
        where: {
          practiceId,
          deletedAt: null,
          active: true,
          ...(providerNpi ? { npi: providerNpi } : { role: "provider" }),
        },
        select: { id: true },
      });

      if (!provider) {
        logger.info("EHR sync: no matching provider, skipping encounter", {
          practiceId,
          fhirAppointmentId: fhirAppt.id,
        });
        skipped++;
        continue;
      }

      const existingEncounter = await prisma.encounter.findFirst({
        where: { practiceId, fhirId: appt.fhirAppointmentId },
        select: { id: true },
      });

      if (existingEncounter) {
        await prisma.encounter.update({
          where: { id: existingEncounter.id },
          data: { encounterDate: appt.encounterDate },
        });
        updated++;
      } else {
        await prisma.encounter.create({
          data: {
            practiceId,
            patientId: patient.id,
            providerId: provider.id,
            encounterDate: appt.encounterDate,
            status: "not_started",
            specialtyType: practice.specialty,
            fhirId: appt.fhirAppointmentId,
          },
        });
        created++;
      }
    }

    // ── 4. Update last sync timestamp on practice ───────────────────────────
    await prisma.practice.update({
      where: { id: practiceId },
      data: { ehrLastSyncAt: new Date() },
    });

    logger.info("EHR sync complete", { practiceId, created, updated, skipped });

    return { success: true, data: { created, updated, skipped } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during EHR sync";
    logger.error("EHR sync failed", { practiceId, error: message });
    return { success: false, error: message };
  }
}
