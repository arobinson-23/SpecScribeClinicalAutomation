/**
 * Epic FHIR client factory.
 * Uses JWT Bearer assertion (RS384) — required for Epic backend (non-user-facing) apps.
 *
 * Setup:
 *   1. Register at https://fhir.epic.com → create a Non-Production Backend System app
 *   2. Generate RSA-2048 key pair, upload JWK public key to the app registration
 *   3. Set env vars: EPIC_FHIR_BASE_URL, EPIC_CLIENT_ID, EPIC_PRIVATE_KEY (base64-encoded PEM)
 *
 * Sandbox base URL: https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
 */

import { createFHIRClient, type FHIRClient } from "./client";

const EPIC_SCOPES = [
  "system/Appointment.read",
  "system/Patient.read",
  "system/Encounter.read",
  "system/DocumentReference.write",
].join(" ");

export interface EpicClientConfig {
  baseUrl: string;
  clientId: string;
  /** Base64-encoded PEM RSA private key */
  privateKeyBase64: string;
}

function resolveConfig(overrides?: Partial<EpicClientConfig>): EpicClientConfig {
  const baseUrl = overrides?.baseUrl ?? process.env.EPIC_FHIR_BASE_URL;
  const clientId = overrides?.clientId ?? process.env.EPIC_CLIENT_ID;
  const privateKeyBase64 = overrides?.privateKeyBase64 ?? process.env.EPIC_PRIVATE_KEY;

  if (!baseUrl || !clientId || !privateKeyBase64) {
    throw new Error(
      "Epic FHIR is not configured. Set EPIC_FHIR_BASE_URL, EPIC_CLIENT_ID, and EPIC_PRIVATE_KEY."
    );
  }

  return { baseUrl, clientId, privateKeyBase64 };
}

export function isEpicConfigured(): boolean {
  return !!(
    process.env.EPIC_FHIR_BASE_URL &&
    process.env.EPIC_CLIENT_ID &&
    process.env.EPIC_PRIVATE_KEY
  );
}

export function createEpicClient(overrides?: Partial<EpicClientConfig>): FHIRClient {
  const config = resolveConfig(overrides);

  const privateKeyPem = Buffer.from(config.privateKeyBase64, "base64").toString("utf-8");

  return createFHIRClient({
    baseUrl: config.baseUrl,
    clientId: config.clientId,
    privateKeyPem,
    authMode: "jwt_bearer",
    scopes: EPIC_SCOPES,
  });
}
