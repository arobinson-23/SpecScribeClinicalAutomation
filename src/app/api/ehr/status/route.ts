import { NextResponse } from "next/server";
import { getDbUser } from "@/lib/auth/get-db-user";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { isEpicConfigured, createEpicClient } from "@/lib/fhir/epic";
import { apiOk, apiErr } from "@/types/api";

export async function GET() {
  const dbUser = await getDbUser();
  if (!dbUser) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });

  if (!hasPermission(dbUser.role, "ehr_sync", "read")) {
    return NextResponse.json(apiErr("Forbidden"), { status: 403 });
  }

  const practice = await prisma.practice.findFirst({
    where: { id: dbUser.practiceId, deletedAt: null },
    select: { ehrType: true, ehrLastSyncAt: true, fhirBaseUrl: true },
  });

  if (!practice) {
    return NextResponse.json(apiErr("Practice not found"), { status: 404 });
  }

  if (!isEpicConfigured()) {
    return NextResponse.json(
      apiOk({ connected: false, ehrType: "none", lastSyncAt: null })
    );
  }

  // Ping the FHIR endpoint to verify live connectivity
  let connected = false;
  try {
    const client = createEpicClient();
    connected = await client.ping();
  } catch {
    connected = false;
  }

  return NextResponse.json(
    apiOk({
      connected,
      ehrType: connected ? "epic" : practice.ehrType,
      lastSyncAt: practice.ehrLastSyncAt?.toISOString() ?? null,
    })
  );
}
