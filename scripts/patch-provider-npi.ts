/**
 * Patches the seeded provider with an Epic sandbox test NPI.
 * The sandbox practitioner FHIR ID is linked to this NPI in Epic's test data.
 */
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();

async function main() {
    // Epic's open sandbox has a known test practitioner whose NPI is 1568797890
    // (Physician, Family Medicine — used in the R4 sandbox test data set).
    const EPIC_SANDBOX_TEST_NPI = "1568797890";

    const providers = await prisma.user.findMany({
        where: { role: "provider", active: true, deletedAt: null },
        select: { id: true, email: true, npi: true },
    });

    if (providers.length === 0) {
        console.error("❌ No provider users found.");
        process.exit(1);
    }

    console.log(`Found ${providers.length} provider(s):`);
    for (const p of providers) {
        console.log(`  • ${p.email} — NPI: ${p.npi ?? "null"}`);
    }

    const toUpdate = providers.filter((p) => !p.npi);

    if (toUpdate.length === 0) {
        console.log("\n✅ All providers already have an NPI — nothing to do.");
        return;
    }

    for (const p of toUpdate) {
        await prisma.user.update({
            where: { id: p.id },
            data: { npi: EPIC_SANDBOX_TEST_NPI },
        });
        console.log(`\n✅ Set NPI on ${p.email}: ${EPIC_SANDBOX_TEST_NPI}`);
    }

    console.log("\nNote: This is the Epic sandbox test practitioner NPI.");
    console.log("In production, use each provider's real NPI number.");
}

main()
    .catch((err) => {
        console.error("❌ Script failed:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
