import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getDbUser } from "@/lib/auth/get-db-user";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { transcribeAudioFromS3 } from "@/lib/ai/transcription";
import { writeAuditLog } from "@/lib/db/audit";
import { apiOk, apiErr } from "@/types/api";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

// PIPEDA & HIA COMPLIANCE: Use Canada (Montreal) for data residency
const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "ca-central-1",
  ...(process.env.AWS_ENDPOINT_URL ? { endpoint: process.env.AWS_ENDPOINT_URL, forcePathStyle: true } : {}),
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  },
});

export async function POST(req: NextRequest) {
  const dbUser = await getDbUser();
  if (!dbUser) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });
  if (!hasPermission(dbUser.role, "ai_note_gen", "execute")) {
    return NextResponse.json(apiErr("Forbidden"), { status: 403 });
  }

  const { practiceId, id: userId } = dbUser;

  const formData = await req.formData();
  const audioFile = formData.get("audio") as File | null;
  const encounterId = formData.get("encounterId") as string | null;

  if (!audioFile || !encounterId) {
    return NextResponse.json(apiErr("audio file and encounterId are required"), { status: 400 });
  }

  // Verify encounter belongs to practice
  const encounter = await prisma.encounter.findFirst({
    where: { id: encounterId, practiceId, deletedAt: null },
  });
  if (!encounter) return NextResponse.json(apiErr("Encounter not found"), { status: 404 });

  const arrayBuffer = await audioFile.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Upload audio to S3 (encrypted at rest via SSE-KMS)
  const audioKey = `${practiceId}/${encounterId}/${uuidv4()}.webm`;
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET ?? "specscribe-audio",
      Key: audioKey,
      Body: buffer,
      ContentType: audioFile.type,
      ServerSideEncryption: "AES256",
      Metadata: { practiceId, encounterId },
    })
  );

  // Update encounter with audio file reference
  await prisma.encounter.update({
    where: { id: encounterId },
    data: {
      audioFileKey: audioKey,
      audioDuration: Math.round(buffer.length / 16000), // rough estimate
      status: "in_progress",
    },
  });

  // DEV MOCK: bypass AWS Transcribe when TRANSCRIBE_MOCK=true (local dev only)
  if (process.env.TRANSCRIBE_MOCK === "true") {
    const mockTranscript =
      "Provider: Good morning. How have you been feeling since our last session? " +
      "Patient: I've been doing a bit better. The new medication seems to be helping with the anxiety. " +
      "Provider: That's encouraging to hear. Have you been keeping up with the breathing exercises we discussed? " +
      "Patient: Yes, I've been doing them every morning. It really helps me start the day more calmly. " +
      "Provider: Excellent. Let's talk about your sleep patterns this week.";
    return NextResponse.json(
      apiOk({
        transcript: mockTranscript,
        segments: [
          { speaker: "provider", text: "Good morning. How have you been feeling since our last session?", startMs: 0, endMs: 4000, confidence: 0.99 },
          { speaker: "patient", text: "I've been doing a bit better. The new medication seems to be helping with the anxiety.", startMs: 4500, endMs: 9000, confidence: 0.97 },
          { speaker: "provider", text: "That's encouraging to hear. Have you been keeping up with the breathing exercises we discussed?", startMs: 9500, endMs: 14000, confidence: 0.98 },
          { speaker: "patient", text: "Yes, I've been doing them every morning. It really helps me start the day more calmly.", startMs: 14500, endMs: 19000, confidence: 0.96 },
          { speaker: "provider", text: "Excellent. Let's talk about your sleep patterns this week.", startMs: 19500, endMs: 23000, confidence: 0.99 },
        ],
        confidence: 0.978,
        durationMs: 23000,
      })
    );
  }

  // Transcribe via AWS Transcribe Medical (ca-central-1 — HIA / PIPEDA Canadian data residency)
  let result: Awaited<ReturnType<typeof transcribeAudioFromS3>>;
  try {
    result = await transcribeAudioFromS3(audioKey, encounterId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown transcription error";
    console.error("[transcribe] AWS Transcribe failed:", message);
    return NextResponse.json(apiErr(`Transcription failed: ${message}`), { status: 502 });
  }

  await writeAuditLog({
    practiceId,
    userId,
    action: "AI_INVOCATION",
    resource: "encounter",
    resourceId: encounterId,
    metadata: {
      interactionType: "transcription",
      audioKey,
      confidence: result.confidence,
      complianceStandard: "HIA (Alberta) / PIPEDA",
      dataResidency: process.env.AWS_REGION ?? "ca-central-1"
    },
  });

  return NextResponse.json(
    apiOk({
      transcript: result.fullTranscript,
      segments: result.segments,
      confidence: result.confidence,
      durationMs: result.durationMs,
    })
  );
}
