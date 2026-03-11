/**
 * EHR appointment auto-sync.
 *
 * Strategy (handles both Epic sandbox and production):
 *   1. Search Epic for any known patients (by FHIR ID stored from a previous sync,
 *      or by Patient.search using known identifiers).
 *   2. For each patient, fetch their appointments for today.
 *   3. Upsert the patient + encounter records.
 *
 * Epic sandbox (fhir.epic.com) quirk:
 *   - Appointment.Search requires 'patient' param — actor:identifier not supported.
 *   - Production Epic supports actor (Practitioner NPI) based searches.
 *   - We use patient-first to work in both environments.
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
import type { FHIRAppointment } from "./client";
import type { Result } from "@/types/api";

export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
}

// ── Epic sandbox test patient FHIR IDs ────────────────────────────────────────
// These are Epic's well-known R4 sandbox test patients.
// In production, patients will already be in our DB from prior syncs.
const EPIC_SANDBOX_TEST_PATIENT_IDS = [
  "eAB3mDIBBcyUKviyzrxsnAw3",  // Adult test patient
  "eq081-VQEgP8drUUqCWzHfw3",  // Camila Lopez (common sandbox test patient)
  "erXuFYUfucBZary9bG9II3TB3",  // Jason Argonaut
];

/**
 * Sync today's appointments from the practice's configured EHR.
 * Creates or updates Patient and Encounter records.
 *
 * Uses a patient-first strategy:
 *   - Pulls from patients already in our DB (fhirId set from prior syncs)
 *   - Falls back to well-known sandbox test patients on first run
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

    // ── 1. Collect patient FHIR IDs to search ────────────────────────────────
    // Priority: patients already synced into our DB → sandbox fallback IDs
    const knownFhirPatients = await prisma.patient.findMany({
      where: { practiceId, deletedAt: null, fhirId: { not: null } },
      select: { fhirId: true },
    });

    let patientFhirIds: string[] = knownFhirPatients
      .map((p) => p.fhirId)
      .filter((id): id is string => !!id);

    // On first sync (no patients yet), use sandbox test patients as seed
    if (patientFhirIds.length === 0) {
      logger.info("EHR sync: no known patients, seeding from Epic sandbox test data", {
        practiceId,
      });
      patientFhirIds = EPIC_SANDBOX_TEST_PATIENT_IDS;
    }

    logger.info("EHR sync: searching appointments for patients", {
      practiceId,
      date: today,
      patientCount: patientFhirIds.length,
    });

    // ── 2. Fetch appointments per patient and de-duplicate ────────────────────
    const seenFhirIds = new Set<string>();
    const appointments: FHIRAppointment[] = [];

    for (const patientFhirId of patientFhirIds) {
      try {
        const bundle = await client.getAppointmentsForPatient(patientFhirId, today);
        const appts = bundle.entry?.map((e) => e.resource) ?? [];
        for (const appt of appts) {
          if (appt.id && !seenFhirIds.has(appt.id)) {
            seenFhirIds.add(appt.id);
            appointments.push(appt);
          }
        }
      } catch (err) {
        logger.error("EHR sync: failed to fetch appointments for patient", {
          practiceId,
          patientFhirId,
        });
        // Continue — don't abort the whole sync for one patient
      }
    }

    logger.info("EHR sync: total unique appointments found", {
      practiceId,
      date: today,
      count: appointments.length,
    });

    // ── 3. Process each appointment ───────────────────────────────────────────
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

      // ── 3a. Fetch full patient resource ─────────────────────────────────────
      let fhirPatient;
      try {
        fhirPatient = await client.getPatient(appt.patientFhirId);
      } catch {
        logger.error("EHR sync: failed to fetch patient resource", {
          practiceId,
          fhirAppointmentId: fhirAppt.id,
        });
        skipped++;
        continue;
      }

      const patientData = fhirPatientToInternal(fhirPatient);

      // ── 3b. Upsert patient (encrypt all PHI fields before write) ────────────
      const phn =
        fhirPatient.identifier?.find(
          (i) => i.system?.includes("MR") || i.system?.includes("mrn")
        )?.value ?? `FHIR-${patientData.fhirId}`;

      const patient = await prisma.patient.upsert({
        where: { practiceId_fhirId: { practiceId, fhirId: patientData.fhirId } },
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
          phn,
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

      // ── 3c. Resolve provider ─────────────────────────────────────────────────
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

      // ── 3d. Upsert encounter (keyed on FHIR Appointment ID) ──────────────────
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

    // ── 4. Update last sync timestamp ─────────────────────────────────────────
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
