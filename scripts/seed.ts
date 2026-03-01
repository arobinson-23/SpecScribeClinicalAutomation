import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create a demo practice
  const practice = await prisma.practice.upsert({
    where: { provincialRegistrationNumber: "CPSA-12345" },
    update: {},
    create: {
      name: "Sunrise Behavioral Health",
      specialty: "behavioral_health",
      provincialRegistrationNumber: "CPSA-12345", // CPSA practice registration number
      address: { street: "123 Main St SW", city: "Calgary", province: "AB", postalCode: "T2P 1N3" },
      phone: "403-555-0100",
      subscriptionTier: "professional",
    },
  });

  console.log("Created practice:", practice.name);

  // Helper to encrypt (simple base64 for seed — real app uses AES-256)
  function e(s: string) {
    // Minimal stand-in — run with APP_SECRET set for real encryption
    return JSON.stringify({ ciphertext: Buffer.from(s).toString("base64"), iv: "seed", authTag: "seed", keyVersion: 1 });
  }

  // Create an admin user
  const adminHash = await hash("AdminPass123!", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@sunrise.example" },
    update: {},
    create: {
      practiceId: practice.id,
      email: "admin@sunrise.example",
      passwordHash: adminHash,
      role: "admin",
      firstName: e("Jane"),
      lastName: e("Smith"),
      mfaEnabled: false,
    },
  });

  console.log("Created admin:", admin.email);

  // Create a provider user
  const provHash = await hash("ProvPass123!", 12);
  const provider = await prisma.user.upsert({
    where: { email: "dr.johnson@sunrise.example" },
    update: {},
    create: {
      practiceId: practice.id,
      email: "dr.johnson@sunrise.example",
      passwordHash: provHash,
      role: "provider",
      firstName: e("Marcus"),
      lastName: e("Johnson"),
      credentials: "MD",
      provincialRegistrationNumber: "CPSA-98765", // CPSA individual physician registration
      mfaEnabled: false,
    },
  });

  console.log("Created provider:", provider.email);

  // Create adam user
  const adamHash = await hash("Awesomeness23", 12);
  const adam = await prisma.user.upsert({
    where: { email: "adamtrobinson00@gmail.com" },
    update: {},
    create: {
      practiceId: practice.id,
      email: "adamtrobinson00@gmail.com",
      passwordHash: adamHash,
      role: "admin",
      firstName: e("Adam"),
      lastName: e("Robinson"),
      mfaEnabled: false,
    },
  });

  console.log("Created user:", adam.email);

  // Seed Canadian payer rules

  // Alberta Health (AHCIP) — primary public payer for all Alberta residents
  await prisma.payerRule.upsert({
    where: { id: "rule-ahcip-time-doc" },
    update: {},
    create: {
      id: "rule-ahcip-time-doc",
      payerName: "Alberta Health (AHCIP)",
      specialty: "behavioral_health",
      ruleType: "documentation",
      ruleContent: {
        description: "Alberta Health requires face-to-face time documented for time-based service codes",
        applies_to: ["08.19A", "03.01AD", "03.07J", "03.08A"],
        requirement: "Document total face-to-face time in minutes, or start/end times",
        reference: "AMA Alberta Physician's Schedule of Medical Benefits",
      },
      effectiveDate: new Date("2024-04-01"),
    },
  });

  // Alberta Blue Cross — primary supplemental private insurer in Alberta
  await prisma.payerRule.upsert({
    where: { id: "rule-abc-prior-auth-psych" },
    update: {},
    create: {
      id: "rule-abc-prior-auth-psych",
      payerName: "Alberta Blue Cross",
      specialty: "behavioral_health",
      ruleType: "prior_auth",
      ruleContent: {
        required_for: ["08.19A"],
        duration_limit: "1 year",
        session_limit: 20,
        note: "Alberta Blue Cross requires PA for psychiatry services exceeding 20 sessions per plan year",
        reference: "ABC Provider Manual — Section 4.3 Mental Health",
      },
      effectiveDate: new Date("2024-01-01"),
    },
  });

  // Sun Life Financial — common group benefits insurer in Canada
  await prisma.payerRule.upsert({
    where: { id: "rule-sunlife-telehealth-modifier" },
    update: {},
    create: {
      id: "rule-sunlife-telehealth-modifier",
      payerName: "Sun Life Financial",
      specialty: "behavioral_health",
      ruleType: "modifier",
      ruleContent: {
        modifier: "TEV",
        description: "Sun Life requires AHCIP telehealth modifier (TEV) for virtual behavioral health visits",
        applies_to: ["03.04A", "03.03A", "08.19A"],
        requirement: "Document patient location and telehealth platform used (must be PIPEDA-compliant)",
      },
      effectiveDate: new Date("2024-01-01"),
    },
  });

  console.log("Seeded Canadian payer rules (Alberta Health, Alberta Blue Cross, Sun Life)");
  console.log("\nSeed complete!");
  console.log("\nDemo credentials:");
  console.log("  Admin: admin@sunrise.example / AdminPass123!");
  console.log("  Provider: dr.johnson@sunrise.example / ProvPass123!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
