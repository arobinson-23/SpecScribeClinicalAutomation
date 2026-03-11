import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/client";
import { encryptPHI } from "@/lib/db/encryption";
import { apiOk, apiErr } from "@/types/api";
import { z } from "zod";

const SetupSchema = z.object({
  practice: z.object({
    name: z.string().min(2).max(200),
    phone: z.string().min(7).max(30),
    street: z.string().min(1).max(200),
    city: z.string().min(1).max(100),
    province: z.string().length(2),
    postalCode: z.string().min(5).max(7),
    businessNumber: z.string().max(9).optional(),
    registrationNumber: z.string().max(100).optional(),
  }),
  profile: z.object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    profession: z.string().min(1).max(50),
    credentials: z.string().max(100).optional(),
    registrationNumber: z.string().max(100).optional(),
    practitionerId: z.string().max(100).optional(),
    providerCount: z.string().regex(/^\d+$/).transform(Number),
  }),
});

export async function POST(req: NextRequest) {
  const clerkUser = await currentUser();
  if (!clerkUser) {
    return NextResponse.json(apiErr("UNAUTHENTICATED"), { status: 401 });
  }

  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) {
    return NextResponse.json(apiErr("NO_EMAIL_ON_CLERK_ACCOUNT"), { status: 400 });
  }

  // Prevent duplicate onboarding
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(apiErr("ALREADY_ONBOARDED"), { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const parsed = SetupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { practice, profile } = parsed.data;

  // Check registration number uniqueness (only if provided)
  if (practice.registrationNumber) {
    const dup = await prisma.practice.findUnique({
      where: { provincialRegistrationNumber: practice.registrationNumber },
    });
    if (dup) {
      return NextResponse.json(apiErr("REGISTRATION_NUMBER_ALREADY_REGISTERED"), { status: 409 });
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const newPractice = await tx.practice.create({
      data: {
        name: practice.name,
        specialty: "behavioral_health",
        phone: practice.phone,
        address: {
          street: practice.street,
          city: practice.city,
          province: practice.province,
          postalCode: practice.postalCode,
        },
        provincialRegistrationNumber: practice.registrationNumber || null,
        businessNumber: practice.businessNumber || null,
        subscriptionTier: "basic",
        settings: { providerCount: profile.providerCount },
      },
    });

    const newUser = await tx.user.create({
      data: {
        practiceId: newPractice.id,
        email,
        role: "admin",
        firstName: encryptPHI(profile.firstName),
        lastName: encryptPHI(profile.lastName),
        credentials: profile.credentials || null,
        provincialRegistrationNumber: profile.registrationNumber || null,
        // Store profession + practitionerId in a non-PHI way via npi field
        // npi is optional string, use for practitionerId
        npi: profile.practitionerId || null,
      },
    });

    return { practiceId: newPractice.id, userId: newUser.id };
  });

  return NextResponse.json(apiOk(result), { status: 201 });
}
