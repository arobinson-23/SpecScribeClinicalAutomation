/**
 * Accuro → SpecScribe internal type mappers.
 * Mirrors src/lib/fhir/mappers.ts.
 * All PHI fields are returned as plaintext — callers must encryptPHI() before DB write.
 */

import type {
    AccuroPatient,
    AccuroAppointment,
    AccuroReferral,
} from "./client";
import type { InternalPatientData, InternalAppointmentData } from "@/lib/fhir/mappers";

// ── Patient ───────────────────────────────────────────────────────────────

export function accuroPatientToInternal(p: AccuroPatient): InternalPatientData {
    const phone = p.phones?.find(
        (ph) => ph.phoneType === "Home" || ph.phoneType === "Mobile" || ph.phoneType === "Work"
    )?.phoneNumber;

    return {
        fhirId: `accuro-${p.patientId}`,   // prefixed to avoid collision with Epic IDs
        firstName: p.firstName,
        lastName: p.lastName,
        dob: p.birthDate,               // already "YYYY-MM-DD"
        sex: mapGender(p.gender),
        phone,
        email: p.email,
    };
}

function mapGender(g?: "M" | "F" | "O" | "U"): string | undefined {
    switch (g) {
        case "M": return "male";
        case "F": return "female";
        case "O": return "other";
        default: return undefined;
    }
}

// ── Appointment ───────────────────────────────────────────────────────────

export function accuroAppointmentToInternal(a: AccuroAppointment): InternalAppointmentData {
    // Combine date + startTime into a full datetime
    const encounterDate = new Date(`${a.date}T${a.startTime}:00`);

    return {
        fhirAppointmentId: `accuro-appt-${a.appointmentId}`,
        encounterDate,
        patientFhirId: `accuro-${a.patientId}`,
        providerFhirId: String(a.providerId),   // stored as string for matching
        status: mapAppointmentStatus(a.status),
    };
}

function mapAppointmentStatus(s: string): string {
    switch (s) {
        case "Confirmed": return "not_started";
        case "Arrived": return "in_progress";
        case "Completed": return "finalized";
        case "No-Show": return "not_started";   // keep but flag
        case "Cancelled": return "not_started";
        default: return "not_started";
    }
}

// ── Referral → PriorAuthRequest fields ───────────────────────────────────

export interface InternalReferralData {
    accuroReferralId: string;
    patientAccuroId: string;
    payerName: string;
    authNumber: string | null;
    status: "pending_submission" | "submitted" | "approved" | "denied" | "expired";
    submittedAt: Date | null;
    approvedAt: Date | null;
    expiresAt: Date | null;
}

export function accuroReferralToInternal(r: AccuroReferral, referralDate: Date): InternalReferralData {
    return {
        accuroReferralId: String(r.referralId),
        patientAccuroId: `accuro-${r.patientId}`,
        payerName: r.insurerName ?? "Unknown Insurer",
        authNumber: r.authorizationNumber ?? null,
        status: mapReferralStatus(r.status),
        submittedAt: referralDate,
        approvedAt: r.status === "Approved" ? referralDate : null,
        expiresAt: r.expiryDate ? new Date(r.expiryDate) : null,
    };
}

function mapReferralStatus(
    s: AccuroReferral["status"]
): InternalReferralData["status"] {
    switch (s) {
        case "Pending": return "submitted";
        case "Approved": return "approved";
        case "Denied": return "denied";
        case "Expired": return "expired";
        case "Cancelled": return "denied";
        default: return "pending_submission";
    }
}

// ── PHN extraction ────────────────────────────────────────────────────────

export function accuroPhn(p: AccuroPatient): string {
    return p.chartNumber || `ACCURO-${p.patientId}`;
}
