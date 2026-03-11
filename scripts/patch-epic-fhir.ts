import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();

async function main() {
    const EPIC_BASE_URL =
        process.env.EPIC_FHIR_BASE_URL ??
        "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4";

    // Find the practice(s) — update all non-deleted, non-epic practices
    const practices = await prisma.practice.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, ehrType: true, fhirBaseUrl: true },
    });

    if (practices.length === 0) {
        console.error("❌ No practices found in the database.");
        process.exit(1);
    }

    console.log(`Found ${practices.length} practice(s):`);
    for (const p of practices) {
        console.log(`  • ${p.name} (${p.id}) — ehrType: ${p.ehrType}, fhirBaseUrl: ${p.fhirBaseUrl ?? "null"}`);
    }

    // Patch all practices that aren't already set to epic
    const toUpdate = practices.filter((p) => p.ehrType !== "epic" || !p.fhirBaseUrl);

    if (toUpdate.length === 0) {
        console.log("\n✅ All practices already configured for Epic FHIR — nothing to do.");
        return;
    }

    for (const p of toUpdate) {
        await prisma.practice.update({
            where: { id: p.id },
            data: {
                fhirBaseUrl: EPIC_BASE_URL,
                ehrType: "epic",
            },
        });
        console.log(`\n✅ Updated practice "${p.name}":`);
        console.log(`   fhirBaseUrl → ${EPIC_BASE_URL}`);
        console.log(`   ehrType     → epic`);
    }
}

main()
    .catch((err) => {
        console.error("❌ Script failed:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
