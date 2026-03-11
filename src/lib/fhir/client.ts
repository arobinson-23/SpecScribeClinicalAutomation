/**
 * FHIR R4 client for EHR integration.
 * Supports SMART on FHIR authorization:
 *   - client_credentials + client_secret (some EHR sandboxes)
 *   - JWT Bearer assertion (Epic backend production — RS384)
 * All calls are scoped to the practice's configured FHIR endpoint.
 */

import { SignJWT, importPKCS8 } from "jose";
import { logger } from "@/lib/utils/logger";

export type FHIRAuthMode = "client_secret" | "jwt_bearer";

interface FHIRClientConfig {
  baseUrl: string;
  clientId: string;
  /** Used when authMode = "client_secret" */
  clientSecret?: string;
  /** PEM-encoded RSA private key; used when authMode = "jwt_bearer" */
  privateKeyPem?: string;
  authMode?: FHIRAuthMode;
  scopes?: string;
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
    this.config = {
      authMode: "client_secret",
      scopes: "system/Patient.read system/Encounter.read system/Appointment.read system/DocumentReference.write",
      ...config,
    };
  }

  // ── Authentication ─────────────────────────────────────────────────────────

  private async getTokenEndpoint(): Promise<string> {
    const conformanceUrl = `${this.config.baseUrl}/.well-known/smart-configuration`;
    const res = await fetch(conformanceUrl, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`FHIR SMART configuration fetch failed: ${res.status} ${conformanceUrl}`);
    }
    const conformance = await res.json() as Record<string, unknown>;
    const endpoint = conformance.token_endpoint as string | undefined;
    if (!endpoint) {
      throw new Error(`FHIR SMART configuration at ${conformanceUrl} did not include a token_endpoint`);
    }
    return endpoint;
  }

  private async buildJwtBearerAssertion(tokenEndpoint: string): Promise<string> {
    if (!this.config.privateKeyPem) {
      throw new Error("JWT Bearer auth requires privateKeyPem in FHIRClient config");
    }
    const privateKey = await importPKCS8(this.config.privateKeyPem, "RS384");
    return new SignJWT({})
      .setProtectedHeader({ alg: "RS384", kid: "specscribe-epic-key-1" })
      .setIssuer(this.config.clientId)
      .setSubject(this.config.clientId)
      .setAudience(tokenEndpoint)
      .setJti(crypto.randomUUID())
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
  }

  private async getAccessToken(): Promise<string> {
    // Reuse cached token if not expired (with 60s buffer)
    if (
      this.config.accessToken &&
      this.config.tokenExpiresAt &&
      Date.now() < this.config.tokenExpiresAt - 60_000
    ) {
      return this.config.accessToken;
    }

    const tokenEndpoint = await this.getTokenEndpoint();

    let params: URLSearchParams;

    if (this.config.authMode === "jwt_bearer") {
      const assertion = await this.buildJwtBearerAssertion(tokenEndpoint);
      params = new URLSearchParams({
        grant_type: "client_credentials",
        client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        client_assertion: assertion,
        scope: this.config.scopes ?? "",
      });
    } else {
      if (!this.config.clientSecret) {
        throw new Error("client_secret auth requires clientSecret in FHIRClient config");
      }
      params = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: this.config.scopes ?? "",
      });
    }

    const tokenRes = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`FHIR token error: ${tokenRes.status} ${err}`);
    }

    const token = await tokenRes.json() as TokenResponse;
    this.config.accessToken = token.access_token;
    this.config.tokenExpiresAt = Date.now() + token.expires_in * 1000;

    return token.access_token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
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

  /** Ping the FHIR server — returns true if reachable and authenticated. */
  async ping(): Promise<boolean> {
    try {
      await this.request<unknown>("metadata");
      return true;
    } catch {
      return false;
    }
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

  // ── Appointment ────────────────────────────────────────────────────────────

  async getAppointmentsForDate(
    date: string,
    options?: {
      /** NPI of the practitioner — used as actor:identifier in production Epic */
      actorNpi?: string;
      /** Raw FHIR Practitioner resource ID */
      actorFhirId?: string;
      /** FHIR Patient resource ID — required by Epic sandbox (fhir.epic.com) */
      patientFhirId?: string;
    }
  ): Promise<FHIRBundle<FHIRAppointment>> {
    // Epic system-scope requires a search anchor alongside 'date'.
    // Sandbox (fhir.epic.com): requires 'patient' — actor:identifier not supported.
    // Production Epic: requires 'actor' (Practitioner NPI or FHIR ID).
    const query = new URLSearchParams();
    query.append("date", `ge${date}`);
    query.append("date", `le${date}`);
    query.append("_count", "100");

    if (options?.patientFhirId) {
      query.set("patient", options.patientFhirId);
    } else if (options?.actorNpi) {
      query.set("actor:identifier", `http://hl7.org/fhir/sid/us-npi|${options.actorNpi}`);
    } else if (options?.actorFhirId) {
      query.set("actor", `Practitioner/${options.actorFhirId}`);
    }

    return this.request<FHIRBundle<FHIRAppointment>>(`Appointment?${query}`);
  }

  /** Fetch all appointments for a specific patient (works in Epic sandbox). */
  async getAppointmentsForPatient(
    patientFhirId: string,
    date?: string
  ): Promise<FHIRBundle<FHIRAppointment>> {
    const query = new URLSearchParams();
    query.set("patient", patientFhirId);
    query.append("_count", "100");
    if (date) {
      query.append("date", `ge${date}`);
      query.append("date", `le${date}`);
    }
    return this.request<FHIRBundle<FHIRAppointment>>(`Appointment?${query}`);
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

export interface FHIRAppointment {
  resourceType: "Appointment";
  id?: string;
  status: string;
  start?: string;
  end?: string;
  serviceType?: Array<{ coding?: Array<{ code: string; display?: string }> }>;
  participant?: Array<{
    actor?: { reference: string; display?: string };
    status: string;
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

export function createFHIRClient(
  config: Omit<FHIRClientConfig, "accessToken" | "tokenExpiresAt">
): FHIRClient {
  return new FHIRClient(config);
}
