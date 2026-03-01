import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/client";
import { encryptPHI } from "@/lib/db/encryption";
import { writeAuditLog } from "@/lib/db/audit";
import { z } from "zod";

const FinalizeNoteSchema = z.object({
  noteText: z.string().min(1).max(100_000),
});

type RouteParams = { params: Promise<{ id: string; noteId: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const dbUser = await prisma.user.findFirst({
    where: { active: true }, // Simplified for demo
    select: { id: true, practiceId: true }
  });

  if (!dbUser) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 403 });

  const { id: encounterId, noteId } = await params;
  const practiceId = dbUser.practiceId;
  const userId = dbUser.id;

  // Validate input
  const body = await req.json().catch(() => null);
  const parsed = FinalizeNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  // Verify encounter belongs to this practice
  const encounter = await prisma.encounter.findFirst({
    where: { id: encounterId, practiceId, deletedAt: null },
  });
  if (!encounter) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Verify note belongs to this encounter
  const existingNote = await prisma.encounterNote.findFirst({
    where: { id: noteId, encounterId },
  });
  if (!existingNote) return NextResponse.json({ error: "NOTE_NOT_FOUND" }, { status: 404 });

  // Encrypt the finalized note content
  const encryptedNote = encryptPHI(parsed.data.noteText);

  // Update note with finalized content and timestamp
  const note = await prisma.encounterNote.update({
    where: { id: noteId },
    data: {
      providerEditedNote: encryptedNote,
      finalizedAt: new Date(),
      finalizedBy: userId,
    },
    select: {
      id: true,
      finalizedAt: true,
    },
  });

  // Update encounter status to indicate note is finalized
  await prisma.encounter.update({
    where: { id: encounterId },
    data: { status: "note_finalized" },
  });

  await writeAuditLog({
    userId,
    practiceId,
    action: "UPDATE",
    resource: "encounter_note",
    resourceId: noteId,
    metadata: {
      fieldsChanged: ["providerEditedNote", "finalizedAt"],
      outcome: "success",
    },
  });

  return NextResponse.json({ data: note });
}
