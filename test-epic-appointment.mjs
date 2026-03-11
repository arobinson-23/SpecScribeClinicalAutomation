/**
 * Tests the Appointment search with the sandbox test practitioner NPI.
 * Run: node test-epic-appointment.mjs
 */
import { SignJWT, importPKCS8 } from 'jose';
import { config } from 'dotenv';

config({ path: '.env.local' });

const clientId = process.env.EPIC_CLIENT_ID;
const baseUrl = process.env.EPIC_FHIR_BASE_URL;
const privateKeyB64 = process.env.EPIC_PRIVATE_KEY;
const privateKeyPem = Buffer.from(privateKeyB64, 'base64').toString('utf-8');

// Step 1: Get token
const smartRes = await fetch(`${baseUrl}/.well-known/smart-configuration`, { headers: { Accept: 'application/json' } });
const smart = await smartRes.json();
const tokenEndpoint = smart.token_endpoint;

const privateKey = await importPKCS8(privateKeyPem, 'RS384');
const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS384', kid: 'specscribe-epic-key-1' })
    .setIssuer(clientId)
    .setSubject(clientId)
    .setAudience(tokenEndpoint)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);

const tokenRes = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: jwt,
        scope: 'system/Appointment.read system/Patient.read system/Encounter.read',
    }).toString(),
});
const token = await tokenRes.json();
const accessToken = token.access_token;
console.log('✅ Token OK — expires in:', token.expires_in, 's\n');

// Step 2: Try Appointment search variations
const today = new Date().toISOString().slice(0, 10);
const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/fhir+json' };

const tests = [
    // Bounded date range only (no actor) — expect 59108
    `${baseUrl}/Appointment?date=ge${today}&date=le${today}&_count=5`,

    // Bounded date range + actor NPI (sandbox test NPI)
    `${baseUrl}/Appointment?date=ge${today}&date=le${today}&actor%3Aidentifier=http%3A%2F%2Fhl7.org%2Ffhir%2Fsid%2Fus-npi%7C1568797890&_count=5`,

    // Wider date range to find ANY appointments in sandbox
    `${baseUrl}/Appointment?date=ge2024-01-01&date=le2026-12-31&actor%3Aidentifier=http%3A%2F%2Fhl7.org%2Ffhir%2Fsid%2Fus-npi%7C1568797890&_count=5`,

    // Try the known Epic sandbox Practitioner FHIR ID directly
    `${baseUrl}/Appointment?actor=Practitioner%2FeM5CWtq15N0WJeuCet5bJlQ3&_count=5`,
];

for (const url of tests) {
    const path = url.replace(baseUrl, '');
    console.log(`\n--- GET ${path} ---`);
    const res = await fetch(url, { headers });
    const body = await res.text();
    const preview = body.slice(0, 400);
    console.log(`Status: ${res.status}`);
    console.log(preview);
}
