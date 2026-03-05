import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

/**
 * GET /api/health
 * Public endpoint — no auth required.
 * Used by load balancers, uptime monitors, and the E2E health smoke test.
 */
export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "ok", timestamp });
  } catch {
    return NextResponse.json(
      { status: "degraded", db: "error", timestamp },
      { status: 503 }
    );
  }
}
