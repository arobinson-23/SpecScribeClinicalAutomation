/**
 * Wipes demo patients/encounters/notes/priorAuth and re-seeds with correct encryption.
 * Safe to run repeatedly.
 */
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();

async function main() {
    const practice = await prisma.practice.findFirst({
        where: { deletedAt: null },
        select: { id: true },
    });
    if (!practice) throw new Error("No practice found");

    const demoMrns = ["MRN-0001", "MRN-0002", "MRN-0003", "MRN-0004", "MRN-0005"];

    // We can't query by encrypted MRN directly, so pull all patients and delete them all
    const patients = await prisma.patient.findMany({
        where: { practiceId: practice.id, deletedAt: null },
        select: { id: true },
    });

    const patientIds = patients.map(p => p.id);
    console.log(`Found ${patientIds.length} patients to wipe.`);

    if (patientIds.length > 0) {
        // Delete cascade: prior auths → encounter notes → encounters → patients
        await prisma.priorAuthRequest.deleteMany({
            where: { encounter: { patientId: { in: patientIds } } },
        });
        await prisma.encounterNote.deleteMany({
            where: { encounter: { patientId: { in: patientIds } } },
        });
        await prisma.aIInteraction.deleteMany({
            where: { encounter: { patientId: { in: patientIds } } },
        });
        await prisma.claimSubmission.deleteMany({
            where: { encounter: { patientId: { in: patientIds } } },
        });
        await prisma.encounter.deleteMany({
            where: { patientId: { in: patientIds } },
        });
        await prisma.patient.deleteMany({
            where: { id: { in: patientIds } },
        });
        console.log("✅ Wiped all demo records.");
    }
}

main()
    .catch(err => { console.error("❌", err); process.exit(1); })
    .finally(() => prisma.$disconnect());
