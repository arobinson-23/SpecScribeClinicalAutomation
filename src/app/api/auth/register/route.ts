import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { encryptPHI } from "@/lib/db/encryption";
import { z } from "zod";

const RegisterSchema = z.object({
  practice: z.object({
    name: z.string().min(2).max(200),
    provincialRegistrationNumber: z.string().min(1).max(50), // e.g. CPSA practice number
    specialty: z.enum(["behavioral_health", "dermatology", "orthopedics", "pain_management", "oncology"]),
    phone: z.string().optional(),
    address: z.object({
      street: z.string().optional(),
      city: z.string().optional(),
      province: z.string().max(2).optional(), // AB, ON, BC, etc.
      postalCode: z.string().max(7).optional(), // A1A 1A1
    }),
  }),
  admin: z.object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    email: z.string().email().max(255),
  }),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { practice, admin } = parsed.data;

  // Check provincial registration number uniqueness
  const existingPractice = await prisma.practice.findUnique({
    where: { provincialRegistrationNumber: practice.provincialRegistrationNumber },
  });
  if (existingPractice) {
    return NextResponse.json({ error: "REGISTRATION_NUMBER_ALREADY_REGISTERED" }, { status: 409 });
  }

  // Check email uniqueness
  const existingUser = await prisma.user.findUnique({ where: { email: admin.email } });
  if (existingUser) {
    return NextResponse.json({ error: "EMAIL_ALREADY_REGISTERED" }, { status: 409 });
  }

  // Create practice + admin user in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const newPractice = await tx.practice.create({
      data: {
        name: practice.name,
        provincialRegistrationNumber: practice.provincialRegistrationNumber,
        specialty: practice.specialty as "behavioral_health",
        phone: practice.phone,
        address: practice.address,
        subscriptionTier: "basic",
        settings: {},
      },
    });

    const newUser = await tx.user.create({
      data: {
        practiceId: newPractice.id,
        email: admin.email,
        role: "admin",
        firstName: encryptPHI(admin.firstName),
        lastName: encryptPHI(admin.lastName),
        mfaEnabled: false,
      },
    });

    return { practiceId: newPractice.id, userId: newUser.id };
  });

  return NextResponse.json({ data: result }, { status: 201 });
}
