import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getDbUser } from "@/lib/auth/get-db-user";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { encryptPHI, decryptPHISafe } from "@/lib/db/encryption";
import { writeAuditLog } from "@/lib/db/audit";
import { apiOk, apiErr } from "@/types/api";
import { z } from "zod";

const createPatientSchema = z.object({
  phn: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sex: z.enum(["male", "female", "other", "unknown"]).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

export async function GET(req: NextRequest) {
  const dbUser = await getDbUser();
  if (!dbUser) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });
  if (!hasPermission(dbUser.role, "patients", "read")) {
    return NextResponse.json(apiErr("Forbidden"), { status: 403 });
  }

  const { practiceId, id: userId } = dbUser;

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const search = searchParams.get("search")?.trim() ?? "";

  // Fetch patients for this practice.
  // Names are AES-encrypted in the DB — we can't filter on them in SQL, so when a search
  // term is provided we pull a large batch (unfiltered) and apply the filter post-decryption.
  const patients = await prisma.patient.findMany({
    where: {
      practiceId,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    take: search ? 200 : limit + 1,
    ...(cursor && !search ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = !search && patients.length > limit;
  const rawItems = hasMore ? patients.slice(0, -1) : patients;

  const decrypted = rawItems.map((p) => ({
    id: p.id,
    phn: p.phn,
    firstName: decryptPHISafe(p.firstName) ?? "[encrypted]",
    lastName: decryptPHISafe(p.lastName) ?? "[encrypted]",
    dob: decryptPHISafe(p.dob) ?? "[encrypted]",
    sex: p.sex,
    createdAt: p.createdAt,
  }));

  // Post-decrypt name/PHN filter (encrypted names can't be filtered in SQL)
  const searchLower = search.toLowerCase();
  const items = search
    ? decrypted
        .filter(
          (p) =>
            p.phn.toLowerCase().includes(searchLower) ||
            p.firstName.toLowerCase().includes(searchLower) ||
            p.lastName.toLowerCase().includes(searchLower) ||
            `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchLower),
        )
        .slice(0, limit)
    : decrypted;

  await writeAuditLog({
    practiceId,
    userId,
    action: "READ",
    resource: "patient",
    fieldsAccessed: ["id", "phn", "firstName", "lastName", "dob"],
    metadata: { count: items.length },
  });

  return NextResponse.json(apiOk({ items, nextCursor: hasMore ? rawItems[rawItems.length - 1]?.id ?? null : null, hasMore }));
}

export async function POST(req: NextRequest) {
  const dbUser = await getDbUser();
  if (!dbUser) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });
  if (!hasPermission(dbUser.role, "patients", "create")) {
    return NextResponse.json(apiErr("Forbidden"), { status: 403 });
  }

  const { practiceId, id: userId } = dbUser;

  const body = await req.json();
  const parsed = createPatientSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json(apiErr(parsed.error.message), { status: 422 });

  const { phn, firstName, lastName, dob, sex, phone, email } = parsed.data;

  // Check for PHN uniqueness within practice
  const existing = await prisma.patient.findUnique({ where: { practiceId_phn: { practiceId, phn } } });
  if (existing) return NextResponse.json(apiErr("A patient with this PHN already exists"), { status: 409 });

  const patient = await prisma.patient.create({
    data: {
      practiceId,
      phn,
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

  return NextResponse.json(apiOk({ id: patient.id, phn: patient.phn }), { status: 201 });
}
