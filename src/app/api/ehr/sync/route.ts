import { NextResponse } from "next/server";
import { getDbUser } from "@/lib/auth/get-db-user";
import { hasPermission } from "@/lib/auth/rbac";
import { syncTodaysAppointments } from "@/lib/fhir/sync";
import { apiOk, apiErr } from "@/types/api";

export async function POST() {
  const dbUser = await getDbUser();
  if (!dbUser) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });

  if (!hasPermission(dbUser.role, "ehr_sync", "execute")) {
    return NextResponse.json(apiErr("Forbidden"), { status: 403 });
  }

  const result = await syncTodaysAppointments(dbUser.practiceId, dbUser.id);

  if (!result.success) {
    return NextResponse.json(apiErr(result.error), { status: 502 });
  }

  return NextResponse.json(apiOk(result.data));
}
