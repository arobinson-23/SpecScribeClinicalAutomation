import { SignJWT, importPKCS8 } from 'jose';
import { config } from 'dotenv';
import { readFileSync } from 'fs';

config({ path: '.env.local' });

const clientId = process.env.EPIC_CLIENT_ID;
const baseUrl = process.env.EPIC_FHIR_BASE_URL;
const privateKeyB64 = process.env.EPIC_PRIVATE_KEY;

if (!clientId || !baseUrl || !privateKeyB64) {
  console.error('Missing env vars:', { clientId: !!clientId, baseUrl: !!baseUrl, privateKeyB64: !!privateKeyB64 });
  process.exit(1);
}

const privateKeyPem = Buffer.from(privateKeyB64, 'base64').toString('utf-8');
console.log('Client ID:', clientId);
console.log('Base URL:', baseUrl);
console.log('PEM header:', privateKeyPem.split('\n')[0]);

// Step 1: Get token endpoint from SMART config
console.log('\n--- Fetching SMART config ---');
const smartUrl = baseUrl + '/.well-known/smart-configuration';
const smartRes = await fetch(smartUrl, { headers: { Accept: 'application/json' } });
console.log('SMART config status:', smartRes.status);

if (!smartRes.ok) {
  console.error('Failed to get SMART config:', await smartRes.text());
  process.exit(1);
}

const smart = await smartRes.json();
const tokenEndpoint = smart.token_endpoint;
console.log('Token endpoint:', tokenEndpoint);

// Step 2: Build JWT assertion
console.log('\n--- Building JWT assertion ---');
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

console.log('JWT built, header:', JSON.parse(Buffer.from(jwt.split('.')[0], 'base64url').toString()));
console.log('JWT claims:', JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()));

// Step 3: Exchange for access token
console.log('\n--- Requesting access token ---');
const params = new URLSearchParams({
  grant_type: 'client_credentials',
  client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
  client_assertion: jwt,
  scope: 'system/Patient.read system/Appointment.read system/Encounter.read',
});

const tokenRes = await fetch(tokenEndpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: params.toString(),
});

console.log('Token response status:', tokenRes.status);
const tokenBody = await tokenRes.text();
console.log('Token response body:', tokenBody.slice(0, 500));

if (tokenRes.ok) {
  const token = JSON.parse(tokenBody);
  console.log('\n✅ Auth SUCCESS! Token type:', token.token_type, 'Expires in:', token.expires_in, 's');

  // Step 4: Test a FHIR resource fetch
  console.log('\n--- Testing FHIR Patient search ---');
  const patientRes = await fetch(`${baseUrl}/Patient?_count=2`, {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      Accept: 'application/fhir+json',
    },
  });
  console.log('Patient search status:', patientRes.status);
  const patientBody = await patientRes.text();
  console.log('Patient search response:', patientBody.slice(0, 300));
}
