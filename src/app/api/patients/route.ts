import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/client";
import { encryptPHI, decryptPHISafe } from "@/lib/db/encryption";
import { writeAuditLog } from "@/lib/db/audit";
import { apiOk, apiErr } from "@/types/api";
import { z } from "zod";

const createPatientSchema = z.object({
  mrn: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sex: z.enum(["male", "female", "other", "unknown"]).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });

  const dbUser = await prisma.user.findFirst({
    where: { active: true },
    select: { id: true, practiceId: true },
  });
  if (!dbUser) return NextResponse.json(apiErr("User records not synchronized"), { status: 403 });

  const practiceId = dbUser.practiceId;
  const userId = dbUser.id;

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const search = searchParams.get("search")?.trim() ?? "";

  // Fetch all patients for this practice (search filter applied post-decryption for encrypted fields)
  const patients = await prisma.patient.findMany({
    where: {
      practiceId,
      deletedAt: null,
      // MRN is stored plaintext — filter server-side for MRN matches, name filtering done post-decryption
      ...(search ? { mrn: { contains: search, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: search ? 50 : limit + 1,
    ...(cursor && !search ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = !search && patients.length > limit;
  const rawItems = hasMore ? patients.slice(0, -1) : patients;

  const decrypted = rawItems.map((p) => ({
    id: p.id,
    mrn: p.mrn,
    firstName: decryptPHISafe(p.firstName) ?? "[encrypted]",
    lastName: decryptPHISafe(p.lastName) ?? "[encrypted]",
    dob: decryptPHISafe(p.dob) ?? "[encrypted]",
    sex: p.sex,
    createdAt: p.createdAt,
  }));

  // Post-decrypt name filter when searching (encrypted names can't be filtered in SQL)
  const items = search
    ? decrypted.filter(
        (p) =>
          p.mrn.toLowerCase().includes(search.toLowerCase()) ||
          p.firstName.toLowerCase().includes(search.toLowerCase()) ||
          p.lastName.toLowerCase().includes(search.toLowerCase()) ||
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()),
      )
    : decrypted;

  await writeAuditLog({
    practiceId,
    userId,
    action: "READ",
    resource: "patient",
    fieldsAccessed: ["id", "mrn", "firstName", "lastName", "dob"],
    metadata: { count: items.length },
  });

  return NextResponse.json(apiOk({ items, nextCursor: hasMore ? rawItems[rawItems.length - 1]?.id ?? null : null, hasMore }));
}

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });

  const dbUser = await prisma.user.findFirst({
    where: { active: true },
    select: { id: true, practiceId: true },
  });
  if (!dbUser) return NextResponse.json(apiErr("User records not synchronized"), { status: 403 });

  const practiceId = dbUser.practiceId;
  const userId = dbUser.id;

  const body = await req.json();
  const parsed = createPatientSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json(apiErr(parsed.error.message), { status: 422 });

  const { mrn, firstName, lastName, dob, sex, phone, email } = parsed.data;

  // Check for MRN uniqueness within practice
  const existing = await prisma.patient.findUnique({ where: { practiceId_mrn: { practiceId, mrn } } });
  if (existing) return NextResponse.json(apiErr("A patient with this MRN already exists"), { status: 409 });

  const patient = await prisma.patient.create({
    data: {
      practiceId,
      mrn,
      firstName: encryptPHI(firstName),
      lastName: encryptPHI(lastName),
      dob: encryptPHI(dob),
      sex,
      phone: phone ? encryptPHI(phone) : null,
      email: email ? encryptPHI(email) : null,
    },
  });

  await writeAuditLog({
    practiceId,
    userId,
    action: "CREATE",
    resource: "patient",
    resourceId: patient.id,
    fieldsChanged: ["firstName", "lastName", "dob", "sex", "phone", "email"],
  });

  return NextResponse.json(apiOk({ id: patient.id, mrn: patient.mrn }), { status: 201 });
}
