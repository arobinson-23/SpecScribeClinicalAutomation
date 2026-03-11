/**
 * Accuro client factory + env config.
 * Mirrors the pattern from src/lib/fhir/epic.ts.
 */

import { AccuroClient } from "./client";

export interface AccuroConfig {
    baseUrl: string;
    oauthUrl: string;
    clientId: string;
    clientSecret: string;
    officeId: number;
}

export function isAccuroConfigured(): boolean {
    return !!(
        process.env.ACCURO_CLIENT_ID &&
        process.env.ACCURO_CLIENT_SECRET &&
        process.env.ACCURO_BASE_URL &&
        process.env.ACCURO_OFFICE_ID
    );
}

export function createAccuroClient(overrides?: Partial<AccuroConfig>): AccuroClient {
    const baseUrl = overrides?.baseUrl ?? process.env.ACCURO_BASE_URL;
    const oauthUrl = overrides?.oauthUrl ?? process.env.ACCURO_OAUTH_URL ?? "https://auth.qhrtech.com/oauth2/token";
    const clientId = overrides?.clientId ?? process.env.ACCURO_CLIENT_ID;
    const clientSecret = overrides?.clientSecret ?? process.env.ACCURO_CLIENT_SECRET;
    const officeIdStr = process.env.ACCURO_OFFICE_ID;
    const officeId = overrides?.officeId ?? (officeIdStr ? parseInt(officeIdStr, 10) : undefined);

    if (!baseUrl || !clientId || !clientSecret || !officeId) {
        throw new Error(
            "Accuro is not configured. Set ACCURO_CLIENT_ID, ACCURO_CLIENT_SECRET, " +
            "ACCURO_BASE_URL, and ACCURO_OFFICE_ID in .env.local."
        );
    }

    return new AccuroClient({ baseUrl, oauthUrl, clientId, clientSecret, officeId });
}
