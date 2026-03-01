/**
 * FHIR R4 client for EHR integration.
 * Supports SMART on FHIR authorization (client credentials flow for backend).
 * All calls are scoped to the practice's configured FHIR endpoint.
 */

import { logger } from "@/lib/utils/logger";

interface FHIRClientConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  tokenExpiresAt?: number;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export class FHIRClient {
  private config: FHIRClientConfig;

  constructor(config: FHIRClientConfig) {
    this.config = config;
  }

  // ── Authentication ─────────────────────────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    // Reuse cached token if not expired (with 60s buffer)
    if (
      this.config.accessToken &&
      this.config.tokenExpiresAt &&
      Date.now() < this.config.tokenExpiresAt - 60_000
    ) {
      return this.config.accessToken;
    }

    // Discover token endpoint from SMART conformance statement
    const conformanceUrl = `${this.config.baseUrl}/.well-known/smart-configuration`;
    const conformanceRes = await fetch(conformanceUrl, {
      headers: { Accept: "application/json" },
    });

    let tokenEndpoint: string;
    if (conformanceRes.ok) {
      const conformance = await conformanceRes.json();
      tokenEndpoint = conformance.token_endpoint;
    } else {
      // Fallback to standard SMART path
      tokenEndpoint = `${this.config.baseUrl}/oauth2/token`;
    }

    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: "system/Patient.read system/Encounter.read system/DocumentReference.write",
    });

    const tokenRes = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`FHIR token error: ${tokenRes.status} ${err}`);
    }

    const token: TokenResponse = await tokenRes.json();
    this.config.accessToken = token.access_token;
    this.config.tokenExpiresAt = Date.now() + token.expires_in * 1000;

    return token.access_token;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const accessToken = await this.getAccessToken();
    const url = `${this.config.baseUrl}/${path}`;

    const res = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/fhir+json",
        "Content-Type": "application/fhir+json",
        Authorization: `Bearer ${accessToken}`,
        ...options.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error("FHIR request failed", { path, status: res.status });
      throw new Error(`FHIR ${res.status}: ${body.slice(0, 200)}`);
    }

    return res.json() as Promise<T>;
  }

  // ── Patient ────────────────────────────────────────────────────────────────

  async getPatient(fhirId: string): Promise<FHIRPatient> {
    return this.request<FHIRPatient>(`Patient/${fhirId}`);
  }

  async searchPatients(params: {
    family?: string;
    given?: string;
    birthdate?: string;
    identifier?: string;
  }): Promise<FHIRBundle<FHIRPatient>> {
    const query = new URLSearchParams();
    if (params.family) query.set("family", params.family);
    if (params.given) query.set("given", params.given);
    if (params.birthdate) query.set("birthdate", params.birthdate);
    if (params.identifier) query.set("identifier", params.identifier);
    return this.request<FHIRBundle<FHIRPatient>>(`Patient?${query}`);
  }

  // ── Encounter ──────────────────────────────────────────────────────────────

  async getEncountersForPatient(
    fhirPatientId: string,
    dateFrom?: string
  ): Promise<FHIRBundle<FHIREncounter>> {
    const query = new URLSearchParams({ patient: fhirPatientId, _sort: "-date", _count: "50" });
    if (dateFrom) query.set("date", `ge${dateFrom}`);
    return this.request<FHIRBundle<FHIREncounter>>(`Encounter?${query}`);
  }

  // ── DocumentReference (push finalized notes back to EHR) ──────────────────

  async createDocumentReference(doc: FHIRDocumentReference): Promise<FHIRDocumentReference> {
    return this.request<FHIRDocumentReference>("DocumentReference", {
      method: "POST",
      body: JSON.stringify(doc),
    });
  }

  async updateDocumentReference(
    fhirId: string,
    doc: FHIRDocumentReference
  ): Promise<FHIRDocumentReference> {
    return this.request<FHIRDocumentReference>(`DocumentReference/${fhirId}`, {
      method: "PUT",
      body: JSON.stringify(doc),
    });
  }
}

// ── FHIR R4 Type Definitions ────────────────────────────────────────────────

export interface FHIRPatient {
  resourceType: "Patient";
  id?: string;
  identifier?: Array<{ system: string; value: string }>;
  name?: Array<{ family?: string; given?: string[]; use?: string }>;
  birthDate?: string;
  gender?: "male" | "female" | "other" | "unknown";
  telecom?: Array<{ system: string; value: string; use?: string }>;
  address?: Array<{
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
  }>;
}

export interface FHIREncounter {
  resourceType: "Encounter";
  id?: string;
  status: string;
  class: { code: string; system: string };
  type?: Array<{ coding?: Array<{ code: string; display?: string }> }>;
  subject?: { reference: string };
  participant?: Array<{ individual?: { reference: string } }>;
  period?: { start?: string; end?: string };
  serviceType?: { coding?: Array<{ code: string; display?: string }> };
}

export interface FHIRDocumentReference {
  resourceType: "DocumentReference";
  id?: string;
  status: "current" | "superseded" | "entered-in-error";
  type?: { coding?: Array<{ code: string; system?: string; display?: string }> };
  subject?: { reference: string };
  context?: { encounter?: Array<{ reference: string }> };
  date?: string;
  content: Array<{
    attachment: {
      contentType: string;
      data?: string; // base64
      url?: string;
      title?: string;
    };
  }>;
}

export interface FHIRBundle<T> {
  resourceType: "Bundle";
  type: string;
  total?: number;
  entry?: Array<{ resource: T; fullUrl?: string }>;
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createFHIRClient(config: Omit<FHIRClientConfig, "accessToken" | "tokenExpiresAt">): FHIRClient {
  return new FHIRClient(config);
}
