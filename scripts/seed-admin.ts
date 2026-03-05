/**
 * One-time seed script: creates the initial Practice + admin User.
 * Run with: npx tsx scripts/seed-admin.ts
 */
import { PrismaClient } from "@prisma/client";
import { createCipheriv, createHash, randomBytes } from "crypto";

const prisma = new PrismaClient();

const APP_SECRET = process.env.APP_SECRET;
if (!APP_SECRET) throw new Error("APP_SECRET not set — load .env.local first");

function encryptPHI(plaintext: string): string {
  const dek = createHash("sha256").update(APP_SECRET!).digest();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", dek, iv, { authTagLength: 16 });
  let ciphertext = cipher.update(plaintext, "utf8", "base64");
  ciphertext += cipher.final("base64");
  return JSON.stringify({
    ciphertext,
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: 1,
  });
}

async function main() {
  const email = "adamtrobinson00@gmail.com";

  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    console.log("User already exists:", existing.id);
    return;
  }

  const practice = await prisma.practice.create({
    data: {
      name: "SpecScribe Practice",
      npi: "0000000000",
      specialty: "behavioral_health",
      address: {},
      subscriptionTier: "basic",
      settings: {},
    },
  });
  console.log("Created practice:", practice.id);

  const user = await prisma.user.create({
    data: {
      practiceId: practice.id,
      email,
      role: "admin",
      firstName: encryptPHI("Adam"),
      lastName: encryptPHI("Robinson"),
      active: true,
    },
  });
  console.log("Created user:", user.id);
  console.log("Done — you can now use the app.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
