/**
 * Seeds realistic clinical demo data for end-to-end pipeline testing.
 * Creates: 5 patients, 8 encounters (various statuses), 3 notes, 2 prior auth requests.
 *
 * Run: npx tsx --tsconfig tsconfig.scripts.json scripts/seed-demo-data.ts
 */
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as crypto from "crypto";

dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();

// ── PHI encryption — must exactly match src/lib/db/encryption.ts ─────────────
// DEK = sha256(APP_SECRET), IV = 16 bytes (not 12), authTagLength = 16
const APP_SECRET = process.env.APP_SECRET!;
if (!APP_SECRET) throw new Error("APP_SECRET missing from .env.local");

function encryptPHI(plaintext: string): string {
    const dek = crypto.createHash("sha256").update(APP_SECRET).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", dek, iv, { authTagLength: 16 });
    let ciphertext = cipher.update(plaintext, "utf8", "base64");
    ciphertext += cipher.final("base64");
    const authTag = cipher.getAuthTag();
    return JSON.stringify({
        ciphertext,
        iv: iv.toString("base64"),
        authTag: authTag.toString("base64"),
        keyVersion: 1,
    });
}

async function main() {
    console.log("🌱 Seeding clinical demo data...\n");

    // ── Find the practice and provider ─────────────────────────────────────────
    const practice = await prisma.practice.findFirst({
        where: { deletedAt: null },
        select: { id: true, name: true, specialty: true },
    });
    if (!practice) throw new Error("No practice found — run the base seed first.");

    const provider = await prisma.user.findFirst({
        where: { practiceId: practice.id, role: "provider", active: true, deletedAt: null },
        select: { id: true, email: true },
    });
    if (!provider) throw new Error("No provider found — run the base seed first.");

    console.log(`Practice: ${practice.name}`);
    console.log(`Provider: ${provider.email}\n`);

    // ── 1. Patients ─────────────────────────────────────────────────────────────
    const patientData = [
        { firstName: "Sarah", lastName: "Mitchell", dob: "1985-03-14", sex: "female", phn: "PHN-0001", phone: "403-555-0101", email: "s.mitchell@example.com" },
        { firstName: "James", lastName: "Okafor", dob: "1972-08-29", sex: "male", phn: "PHN-0002", phone: "403-555-0102", email: "j.okafor@example.com" },
        { firstName: "Elena", lastName: "Petrov", dob: "1990-11-05", sex: "female", phn: "PHN-0003", phone: "403-555-0103", email: "e.petrov@example.com" },
        { firstName: "Marcus", lastName: "Tran", dob: "1968-06-22", sex: "male", phn: "PHN-0004", phone: "403-555-0104", email: null },
        { firstName: "Amara", lastName: "Diallo", dob: "2001-01-30", sex: "female", phn: "PHN-0005", phone: "403-555-0105", email: "a.diallo@example.com" },
    ];

    const patients: { id: string; firstName: string; lastName: string }[] = [];

    for (const p of patientData) {
        const existing = await prisma.patient.findUnique({
            where: { practiceId_phn: { practiceId: practice.id, phn: p.phn } },
        });

        let patient;
        if (existing) {
            patient = existing;
            console.log(`  ↩  Patient already exists: ${p.firstName} ${p.lastName}`);
        } else {
            patient = await prisma.patient.create({
                data: {
                    practiceId: practice.id,
                    phn: p.phn,
                    firstName: encryptPHI(p.firstName),
                    lastName: encryptPHI(p.lastName),
                    dob: encryptPHI(p.dob),
                    sex: p.sex,
                    phone: p.phone ? encryptPHI(p.phone) : null,
                    email: p.email ? encryptPHI(p.email) : null,
                },
            });
            console.log(`  ✅ Created patient: ${p.firstName} ${p.lastName} (${p.phn})`);
        }
        patients.push({ id: patient.id, firstName: p.firstName, lastName: p.lastName });
    }

    // ── 2. Encounters ───────────────────────────────────────────────────────────
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const twoDaysAgo = new Date(today); twoDaysAgo.setDate(today.getDate() - 2);
    const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7);

    const encounterData = [
        // Today — ready to record
        { patientIdx: 0, date: today, status: "not_started", specialty: practice.specialty, label: "Today — not started (Sarah Mitchell)" },
        { patientIdx: 1, date: today, status: "not_started", specialty: practice.specialty, label: "Today — not started (James Okafor)" },
        // In-progress / needs AI
        { patientIdx: 2, date: yesterday, status: "in_progress", specialty: practice.specialty, label: "Yesterday — in progress (Elena Petrov)" },
        // Needs review — note generated, waiting for provider
        { patientIdx: 3, date: yesterday, status: "needs_review", specialty: practice.specialty, label: "Yesterday — needs review (Marcus Tran)" },
        // Already finalized
        { patientIdx: 4, date: twoDaysAgo, status: "finalized", specialty: practice.specialty, label: "2 days ago — finalized (Amara Diallo)" },
        // Future appointment
        { patientIdx: 0, date: nextWeek, status: "not_started", specialty: practice.specialty, label: "Next week — future (Sarah Mitchell)" },
        // Two more for variety
        { patientIdx: 1, date: twoDaysAgo, status: "finalized", specialty: practice.specialty, label: "2 days ago — finalized (James Okafor)" },
        { patientIdx: 4, date: today, status: "not_started", specialty: practice.specialty, label: "Today — not started (Amara Diallo)" },
    ] as const;

    const createdEncounters: { id: string; patientIdx: number; status: string }[] = [];

    for (const enc of encounterData) {
        const existing = await prisma.encounter.findFirst({
            where: {
                practiceId: practice.id,
                patientId: patients[enc.patientIdx].id,
                encounterDate: enc.date,
                status: enc.status as never,
            },
        });

        if (existing) {
            console.log(`  ↩  Encounter already exists: ${enc.label}`);
            createdEncounters.push({ id: existing.id, patientIdx: enc.patientIdx, status: enc.status });
        } else {
            const encounter = await prisma.encounter.create({
                data: {
                    practiceId: practice.id,
                    patientId: patients[enc.patientIdx].id,
                    providerId: provider.id,
                    encounterDate: enc.date,
                    status: enc.status as never,
                    specialtyType: enc.specialty,
                },
            });
            console.log(`  ✅ Created encounter: ${enc.label}`);
            createdEncounters.push({ id: encounter.id, patientIdx: enc.patientIdx, status: enc.status });
        }
    }

    // ── 3. Notes (for encounters that need_review / finalized) ──────────────────
    const sampleTranscripts = [
        // Marcus Tran — needs_review
        `Provider: Good morning Marcus. How have you been since our last session?
Patient: Honestly, it's been a rough two weeks. The sleep is still really bad — maybe 4 hours a night. And I've been having these intrusive thoughts again, mostly at work.
Provider: Can you describe the intrusive thoughts? Are they specific to work situations or more generalized?
Patient: They're mostly about failure. Like, I'll be in a meeting and suddenly I'm convinced I'm going to say something wrong and everyone will see I don't belong there. It's the old imposter syndrome stuff but more intense now.
Provider: Are you still taking the sertraline at 50mg?
Patient: Yes, but I skipped a couple of days last week because I ran out and couldn't get to the pharmacy. I noticed I felt way worse those days.
Provider: That's important to note — sertraline discontinuation even over a couple of days can worsen symptoms significantly. Let's make sure we get a 90-day supply sent to the pharmacy closest to your work so this doesn't happen again. How's your mood on a scale of 1 to 10?
Patient: Maybe a 4. I have okay moments but mostly I feel flat and anxious.
Provider: And any thoughts of self-harm or hopelessness?
Patient: No, nothing like that. I want to feel better, I just can't seem to get there.
Provider: That's actually a meaningful distinction — motivation to improve is a strong protective factor. I want to add brief CBT techniques focused on cognitive restructuring for the imposter syndrome patterns. We'll also increase check-in frequency to every two weeks for the next month.`,

        // Amara Diallo — finalized
        `Provider: Hi Amara, come on in. How are things going since we started the new treatment plan last month?
Patient: So much better honestly. I'm sleeping through the night most nights now, which is huge for me. The anxiety is still there but it's not running my life like it was.
Provider: That's excellent progress. Are you still doing the mindfulness exercises we discussed?
Patient: Yeah, I do them every morning now. It's become like brushing my teeth — just part of the routine.
Provider: Perfect. PHQ-9 score today?
Patient: I filled it out in the waiting room — I think I got an 8?
Provider: Yes, 8 — that's down from 17 six weeks ago. That's clinically significant improvement. How are you finding the bupropion at 150mg?
Patient: Fine, I think. My appetite is a bit suppressed but I'm not complaining about that honestly.
Provider: Good. Let's maintain the current dose and continue with biweekly sessions for another month, then we can consider spacing to monthly.`,
    ];

    // Find the needs_review encounter (Marcus Tran — index 3 in encounterData)
    const needsReviewEnc = createdEncounters.find((e) => e.status === "needs_review");
    const finalizedEncs = createdEncounters.filter((e) => e.status === "finalized");

    if (needsReviewEnc) {
        const existing = await prisma.encounterNote.findFirst({
            where: { encounterId: needsReviewEnc.id },
        });
        if (!existing) {
            await prisma.encounterNote.create({
                data: {
                    encounterId: needsReviewEnc.id,
                    noteType: "progress_note",
                    noteFormat: "SOAP",
                    rawTranscript: encryptPHI(sampleTranscripts[0]),
                    aiGeneratedNote: encryptPHI(generateSoapNote("Marcus", "Tran", "Major Depressive Disorder, Generalized Anxiety Disorder", sampleTranscripts[0])),
                    wordCount: 320,
                },
            });
            console.log(`  ✅ Created AI-generated note for needs_review encounter (Marcus Tran)`);
        }
    }

    if (finalizedEncs.length > 0) {
        const finEnc = finalizedEncs[0];
        const existing = await prisma.encounterNote.findFirst({
            where: { encounterId: finEnc.id },
        });
        if (!existing) {
            const note = await prisma.encounterNote.create({
                data: {
                    encounterId: finEnc.id,
                    noteType: "progress_note",
                    noteFormat: "SOAP",
                    rawTranscript: encryptPHI(sampleTranscripts[1]),
                    aiGeneratedNote: encryptPHI(generateSoapNote("Amara", "Diallo", "Major Depressive Disorder (moderate, improving)", sampleTranscripts[1])),
                    providerEditedNote: encryptPHI(generateSoapNote("Amara", "Diallo", "Major Depressive Disorder (moderate, improving)", sampleTranscripts[1])),
                    wordCount: 290,
                    finalizedAt: new Date(twoDaysAgo),
                    finalizedBy: provider.id,
                    aiAcceptanceRate: 0.94,
                },
            });
            console.log(`  ✅ Created finalized note for encounter (Amara Diallo)`);
        }
    }

    // ── 4. Prior Auth Requests ──────────────────────────────────────────────────
    if (needsReviewEnc) {
        const existing = await prisma.priorAuthRequest.findFirst({
            where: { encounterId: needsReviewEnc.id },
        });
        if (!existing) {
            await prisma.priorAuthRequest.create({
                data: {
                    practiceId: practice.id,
                    encounterId: needsReviewEnc.id,
                    payerId: "AB-BLUECROSS-001",
                    payerName: "Alberta Blue Cross",
                    procedureCodes: ["08.19A"],
                    diagnosisCodes: ["F32.1", "F41.1"],
                    status: "pending_submission",
                    clinicalSummary: "Patient presents with moderate major depressive disorder (PHQ-9: 14) and co-morbid generalized anxiety. Session 8 of yearly limit. Continued psychiatric management indicated with sertraline optimization and CBT. Prior documentation demonstrates treatment responsiveness.",
                },
            });
            console.log(`  ✅ Created prior auth request for Marcus Tran (Alberta Blue Cross)`);
        }
    }

    // Second prior auth for a finalized encounter
    if (finalizedEncs.length > 1) {
        const finEnc2 = finalizedEncs[1];
        const existing = await prisma.priorAuthRequest.findFirst({
            where: { encounterId: finEnc2.id },
        });
        if (!existing) {
            await prisma.priorAuthRequest.create({
                data: {
                    practiceId: practice.id,
                    encounterId: finEnc2.id,
                    payerId: "SL-001",
                    payerName: "Sun Life Financial",
                    procedureCodes: ["03.04A"],
                    diagnosisCodes: ["F33.0"],
                    status: "approved",
                    authNumber: "SL-2026-447821",
                    submittedAt: new Date(twoDaysAgo),
                    approvedAt: new Date(yesterday),
                    expiresAt: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
                    clinicalSummary: "Telehealth session for recurrent depressive disorder with excellent treatment response (PHQ-9 improved from 17 to 8). Continued virtual care with bupropion 150mg and mindfulness-based CBT.",
                },
            });
            console.log(`  ✅ Created approved prior auth for James Okafor (Sun Life)`);
        }
    }

    // ── Summary ────────────────────────────────────────────────────────────────
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Demo data seeded successfully!

📋 What's in the app now:
   • 5 patients (all encrypted)
   • 8 encounters across different statuses
   • 2 AI-generated notes (1 needs review, 1 finalized)
   • 2 prior auth requests (1 pending, 1 approved)

🧪 Pipeline to test:
   1. /encounters          — see all encounters listed
   2. Open a "not_started" encounter → record audio or type a transcript
   3. Click "Generate Note" → AI generates a SOAP/DAP note draft
   4. Review and accept/edit the note → Finalize
   5. /prior-auth          — view and submit prior auth requests
   
📌 Credentials (if needed):
   Provider: adamtrobinson00@gmail.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

// ── Helper: generate a realistic SOAP note ───────────────────────────────────
function generateSoapNote(firstName: string, lastName: string, diagnosis: string, transcript: string): string {
    return `PROGRESS NOTE — ${firstName} ${lastName}
Date: ${new Date().toLocaleDateString("en-CA")}
Note Type: SOAP — Psychiatry / Behavioral Health

SUBJECTIVE:
Patient presents for follow-up psychiatric evaluation. ${firstName} reports continued challenges with sleep initiation and maintenance (averaging 4 hours per night), alongside recurrent cognitive distortions consistent with imposter syndrome pattern. Sleep disruption appears to be compounding daytime anxiety and mood instability. Patient denies suicidal ideation, homicidal ideation, or intent to harm self or others. Reports adherence to prescribed pharmacotherapy with a brief 2-day gap last week due to medication supply interruption.

Current Medications: Sertraline 50mg PO daily (with noted 2-day gap)
PHQ-9 Score: 14 (moderate severity)
GAD-7 Score: 11 (moderate severity)

OBJECTIVE:
Patient is alert, oriented x4. Affect is constricted and dysthymic. Speech is normal in rate and rhythm. Thought process is linear and goal-directed. No psychomotor abnormalities observed. Insight and judgment intact. Denies perceptual disturbances.

ASSESSMENT:
1. ${diagnosis}
   - Moderate severity with partial response to current pharmacotherapy
   - Cognitive distortions (imposter syndrome, catastrophizing) identified as active treatment targets
   - Medication gap likely contributed to symptom worsening last week

PLAN:
1. Continue sertraline 50mg — send 90-day supply to workplace-proximal pharmacy to prevent future gaps
2. Initiate structured CBT module — cognitive restructuring for imposter syndrome and workplace anxiety
3. Increase visit frequency to every 2 weeks x 1 month, then reassess
4. Return to clinic if symptoms worsen significantly before next scheduled appointment
5. Safety plan reviewed and in place

Provider Attestation: This note was AI-drafted and reviewed, edited, and finalized by the treating provider. Provider assumes full clinical and legal responsibility for all documentation.

Electronically signed via SpecScribe — ${new Date().toISOString()}`;
}

main()
    .catch((err) => {
        console.error("\n❌ Seed failed:", err.message ?? err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
