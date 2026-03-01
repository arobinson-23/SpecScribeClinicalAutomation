import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
    try {
        const practiceId = "test-practice-id";
        await prisma.complianceAlert.upsert({
            where: {
                id: "test-id",
            },
            create: {
                id: "test-id",
                practice: { connect: { id: practiceId } },
                alertType: "hipaa_check",
                severity: "info",
                title: "Test Alert",
                description: "This is a test desc",
            },
            update: {
                description: "This is a test desc",
                updatedAt: new Date(),
            },
        });
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
