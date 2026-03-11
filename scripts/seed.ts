import { PrismaClient } from "@prisma/client";
import { createCipheriv, createHash, randomBytes } from "crypto";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();

// Real encryption logic copied from src/lib/db/encryption.ts to ensure data is valid
function encryptPHI(plaintext: string): string {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error("APP_SECRET not set");

  const dek = createHash("sha256").update(secret).digest();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", dek, iv, { authTagLength: 16 });

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
  console.log("Seeding database with VALID encrypted data...");

  // Clear existing data to ensure clean seed
  await prisma.priorAuthRequest.deleteMany();
  await prisma.encounterCode.deleteMany();
  await prisma.encounterNote.deleteMany();
  await prisma.encounter.deleteMany();
  await prisma.patient.deleteMany();

  const practice = await prisma.practice.upsert({
    where: { provincialRegistrationNumber: "CPSA-12345" },
    update: {},
    create: {
      name: "Sunrise Behavioral Health",
      specialty: "behavioral_health",
      provincialRegistrationNumber: "CPSA-12345",
      address: { street: "123 Main St SW", city: "Calgary", province: "AB", postalCode: "T2P 1N3" },
      phone: "403-555-0100",
      subscriptionTier: "professional",
    },
  });

  const user = await prisma.user.upsert({
    where: { email: "adamtrobinson00@gmail.com" },
    update: {},
    create: {
      practiceId: practice.id,
      email: "adamtrobinson00@gmail.com",
      role: "admin",
      firstName: encryptPHI("Adam"),
      lastName: encryptPHI("Robinson"),
    },
  });

  const patient1 = await prisma.patient.create({
    data: {
      practiceId: practice.id,
      phn: "PHN-1001",
      firstName: encryptPHI("Sarah"),
      lastName: encryptPHI("Miller"),
      dob: "1985-06-12",
      sex: "Female",
    }
  });

  const patient2 = await prisma.patient.create({
    data: {
      practiceId: practice.id,
      phn: "PHN-1002",
      firstName: encryptPHI("James"),
      lastName: encryptPHI("Wilson"),
      dob: "1972-11-20",
      sex: "Male",
    }
  });

  const encounter1 = await prisma.encounter.create({
    data: {
      practiceId: practice.id,
      patientId: patient1.id,
      providerId: user.id,
      specialtyType: "behavioral_health",
      status: "finalized",
      encounterDate: new Date(),
      notes: {
        create: {
          noteType: "consultation",
          noteFormat: "SOAP",
          aiGeneratedNote: encryptPHI("Patient presents with anxiety. Suggesting SSRI and therapy."),
          providerEditedNote: encryptPHI("Patient presents with generalized anxiety. Prescribed Sertraline 50mg. Referral to CBT."),
          finalizedAt: new Date(),
          finalizedBy: user.id,
        }
      },
      codes: {
        createMany: {
          data: [
            { codeType: "ICD10" as any, code: "F41.1", description: "Generalized anxiety disorder", providerAccepted: true },
            { codeType: "AHCIP" as any, code: "08.19A", description: "Psychiatric assessment", modifier: "TEV", providerAccepted: true }
          ]
        }
      }
    }
  });

  const encounter2 = await prisma.encounter.create({
    data: {
      practiceId: practice.id,
      patientId: patient2.id,
      providerId: user.id,
      specialtyType: "behavioral_health",
      status: "needs_review",
      encounterDate: new Date(Date.now() - 86400000),
      notes: {
        create: {
          noteType: "progress_note",
          noteFormat: "SOAP",
          rawTranscript: "Patient complains of persistent depressive symptoms. Previous treatments unsuccessful.",
          aiGeneratedNote: encryptPHI("### SUBJECTIVE\nPatient reports persistent depressive mood for 3 months...\n\n### OBJECTIVE\nFlat affect noted during interview..."),
        }
      },
      codes: {
        createMany: {
          data: [
            { codeType: "ICD10" as any, code: "F33.1", description: "Major depressive disorder, moderate", aiConfidence: 0.92 },
            { codeType: "AHCIP" as any, code: "03.04A", description: "Comprehensive visit", aiConfidence: 0.88 }
          ]
        }
      }
    }
  });

  await prisma.priorAuthRequest.create({
    data: {
      practiceId: practice.id,
      encounterId: encounter1.id,
      payerId: "alberta_blue_cross",
      payerName: "Alberta Blue Cross",
      procedureCodes: ["08.19A"] as any,
      diagnosisCodes: ["F41.1"] as any,
      status: "submitted",
      submittedAt: new Date(),
      clinicalSummary: encryptPHI("Based on clinical evaluation, the patient meets criteria for CBT due to chronic GAD."),
      medicalNecessityStatement: encryptPHI("Treatment is required to prevent functional decline and improve daily coping.") as any,
      missingDocumentation: ["Initial intake assessment from 2023"] as any
    } as any
  });

  console.log("Seed successful with REAL encryption.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
