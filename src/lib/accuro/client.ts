/**
 * Accuro (QHR / TELUS Health) REST API client.
 *
 * Authentication: OAuth 2.0 Client Credentials
 *   POST {ACCURO_OAUTH_URL}
 *   grant_type=client_credentials
 *   client_id=... client_secret=...
 *
 * All requests scope to a single Accuro office (clinic).
 * Credentials go in env:
 *   ACCURO_CLIENT_ID        — from QHR Partner Portal
 *   ACCURO_CLIENT_SECRET    — from QHR Partner Portal
 *   ACCURO_BASE_URL         — https://rest.ehrnavigator.com (sandbox + prod same host)
 *   ACCURO_OAUTH_URL        — https://auth.qhrtech.com/oauth2/token
 *   ACCURO_OFFICE_ID        — integer office ID for this practice (from GET /offices)
 */

import { logger } from "@/lib/utils/logger";

// ── Accuro REST types (R4-adjacent, proprietary schema) ────────────────────

export interface AccuroPatient {
    patientId: number;
    chartNumber: string;
    lastName: string;
    firstName: string;
    birthDate: string;         // "YYYY-MM-DD"
    gender?: "M" | "F" | "O" | "U";
    phones?: Array<{ phoneType: string; phoneNumber: string }>;
    email?: string;
    active: boolean;
}

export interface AccuroAppointment {
    appointmentId: number;
    patientId: number;
    providerId: number;
    officeId: number;
    date: string;              // "YYYY-MM-DD"
    startTime: string;         // "HH:mm"
    endTime: string;           // "HH:mm"
    appointmentType?: string;
    status: string;            // "Confirmed" | "Cancelled" | "No-Show" | "Arrived" | "Completed"
    reason?: string;
}

export interface AccuroProvider {
    providerId: number;
    firstName: string;
    lastName: string;
    registrationNumber?: string;  // Provincial registration #
    npi?: string;
    active: boolean;
}

export interface AccuroReferral {
    referralId: number;
    patientId: number;
    providerId: number;
    referralDate: string;       // "YYYY-MM-DD"
    insurerId?: number;
    insurerName?: string;
    authorizationNumber?: string;
    status: "Pending" | "Approved" | "Denied" | "Cancelled" | "Expired";
    expiryDate?: string;        // "YYYY-MM-DD"
    serviceType?: string;
    notes?: string;
}

export interface AccuroInsurancePlan {
    planId: number;
    insurerId: number;
    insurerName: string;
    policyNumber: string;
    groupNumber?: string;
    effectiveDate?: string;
    expiryDate?: string;
    primary: boolean;
}

export interface AccuroOffice {
    officeId: number;
    name: string;
    address?: string;
    phone?: string;
}

// ── Token cache ────────────────────────────────────────────────────────────

interface TokenCache {
    accessToken: string;
    expiresAt: number;
}

let _tokenCache: TokenCache | null = null;

// ── AccuroClient ───────────────────────────────────────────────────────────

export class AccuroClient {
    private readonly baseUrl: string;
    private readonly oauthUrl: string;
    private readonly clientId: string;
    private readonly clientSecret: string;
    private readonly officeId: number;

    constructor(config: {
        baseUrl: string;
        oauthUrl: string;
        clientId: string;
        clientSecret: string;
        officeId: number;
    }) {
        this.baseUrl = config.baseUrl.replace(/\/$/, "");
        this.oauthUrl = config.oauthUrl;
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.officeId = config.officeId;
    }

    // ── Auth (Client Credentials — much simpler than Epic JWT) ────────────────

    private async getAccessToken(): Promise<string> {
        // Reuse cached token until 60s before expiry
        if (_tokenCache && Date.now() < _tokenCache.expiresAt - 60_000) {
            return _tokenCache.accessToken;
        }

        const res = await fetch(this.oauthUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "client_credentials",
                client_id: this.clientId,
                client_secret: this.clientSecret,
                scope: "user/Patient.read user/Appointment.read user/Referral.read user/Provider.read user/Letter.write",
            }).toString(),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Accuro OAuth failed: ${res.status} ${err.slice(0, 200)}`);
        }

        const body = await res.json() as { access_token: string; expires_in: number };
        _tokenCache = {
            accessToken: body.access_token,
            expiresAt: Date.now() + body.expires_in * 1000,
        };

        return _tokenCache.accessToken;
    }

    private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
        const token = await this.getAccessToken();
        const url = `${this.baseUrl}${path}`;

        const res = await fetch(url, {
            ...options,
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                ...options.headers,
            },
        });

        if (!res.ok) {
            const body = await res.text();
            logger.error("Accuro request failed", { path, status: res.status });
            throw new Error(`Accuro ${res.status}: ${body.slice(0, 300)}`);
        }

        return res.json() as Promise<T>;
    }

    // ── Connectivity check ────────────────────────────────────────────────────

    async ping(): Promise<boolean> {
        try {
            await this.request<unknown>(`/api/v1/offices/${this.officeId}`);
            return true;
        } catch {
            return false;
        }
    }

    // ── Offices ───────────────────────────────────────────────────────────────

    async getOffice(): Promise<AccuroOffice> {
        return this.request<AccuroOffice>(`/api/v1/offices/${this.officeId}`);
    }

    async listOffices(): Promise<AccuroOffice[]> {
        return this.request<AccuroOffice[]>(`/api/v1/offices`);
    }

    // ── Providers ─────────────────────────────────────────────────────────────

    async listProviders(): Promise<AccuroProvider[]> {
        return this.request<AccuroProvider[]>(
            `/api/v1/providers?officeId=${this.officeId}&active=true`
        );
    }

    async getProviderByRegistrationNumber(
        registrationNumber: string
    ): Promise<AccuroProvider | null> {
        const providers = await this.listProviders();
        return providers.find((p) => p.registrationNumber === registrationNumber) ?? null;
    }

    // ── Patients ──────────────────────────────────────────────────────────────

    async getPatient(patientId: number): Promise<AccuroPatient> {
        return this.request<AccuroPatient>(`/api/v1/patients/${patientId}`);
    }

    async searchPatients(params: {
        lastName?: string;
        firstName?: string;
        birthDate?: string;   // "YYYY-MM-DD"
        chartNumber?: string;
    }): Promise<AccuroPatient[]> {
        const query = new URLSearchParams();
        if (params.lastName) query.set("lastName", params.lastName);
        if (params.firstName) query.set("firstName", params.firstName);
        if (params.birthDate) query.set("birthDate", params.birthDate);
        if (params.chartNumber) query.set("chartNumber", params.chartNumber);
        return this.request<AccuroPatient[]>(`/api/v1/patients?${query}`);
    }

    async getPatientInsurance(patientId: number): Promise<AccuroInsurancePlan[]> {
        return this.request<AccuroInsurancePlan[]>(
            `/api/v1/patients/${patientId}/insurancePlans`
        );
    }

    // ── Appointments ─────────────────────────────────────────────────────────
    // Key advantage over Epic: can query by providerId + date directly

    async getAppointmentsForDate(
        date: string,          // "YYYY-MM-DD"
        providerId?: number
    ): Promise<AccuroAppointment[]> {
        const query = new URLSearchParams({
            officeId: String(this.officeId),
            date,
        });
        if (providerId) query.set("providerId", String(providerId));
        return this.request<AccuroAppointment[]>(`/api/v1/appointments?${query}`);
    }

    async getAppointmentsForPatient(
        patientId: number,
        dateFrom?: string,
        dateTo?: string
    ): Promise<AccuroAppointment[]> {
        const query = new URLSearchParams({ patientId: String(patientId) });
        if (dateFrom) query.set("dateFrom", dateFrom);
        if (dateTo) query.set("dateTo", dateTo);
        return this.request<AccuroAppointment[]>(`/api/v1/appointments?${query}`);
    }

    // ── Referrals (PA tracking) ───────────────────────────────────────────────

    async getReferrals(patientId: number): Promise<AccuroReferral[]> {
        return this.request<AccuroReferral[]>(
            `/api/v1/patients/${patientId}/referrals`
        );
    }

    async getOpenReferrals(patientId: number): Promise<AccuroReferral[]> {
        const all = await this.getReferrals(patientId);
        return all.filter((r) => r.status === "Pending" || r.status === "Approved");
    }

    // ── Letters / Notes (push finalized notes back to Accuro) ─────────────────

    async createLetter(params: {
        patientId: number;
        providerId: number;
        date: string;          // "YYYY-MM-DD"
        subject: string;
        content: string;       // plain text or HTML
        letterType?: string;   // e.g. "ProgressNote"
    }): Promise<{ letterId: number }> {
        return this.request<{ letterId: number }>(
            `/api/v1/patients/${params.patientId}/letters`,
            {
                method: "POST",
                body: JSON.stringify({
                    providerId: params.providerId,
                    date: params.date,
                    subject: params.subject,
                    body: params.content,
                    letterType: params.letterType ?? "ProgressNote",
                    officeId: this.officeId,
                }),
            }
        );
    }
}
