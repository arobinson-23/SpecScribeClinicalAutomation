import {
  TranscribeClient,
  StartMedicalTranscriptionJobCommand,
  GetMedicalTranscriptionJobCommand,
  TranscriptionJobStatus,
} from "@aws-sdk/client-transcribe";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import type { TranscriptSegment } from "@/types/encounter";
import { logger } from "@/lib/utils/logger";
import { v4 as uuidv4 } from "uuid";

// HIA / PIPEDA: all audio processed in ca-central-1 (Montreal) — Canadian data residency
const TRANSCRIBE_REGION = process.env.AWS_REGION ?? "ca-central-1";

function getTranscribeClient(): TranscribeClient {
  return new TranscribeClient({
    region: TRANSCRIBE_REGION,
    credentials:
      process.env.AWS_ACCESS_KEY_ID
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
            sessionToken: process.env.AWS_SESSION_TOKEN,
          }
        : undefined, // fall through to IAM role in production
  });
}

function getS3Client(): S3Client {
  return new S3Client({
    region: TRANSCRIBE_REGION,
    ...(process.env.AWS_ENDPOINT_URL
      ? { endpoint: process.env.AWS_ENDPOINT_URL, forcePathStyle: true }
      : {}),
    credentials:
      process.env.AWS_ACCESS_KEY_ID
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
            sessionToken: process.env.AWS_SESSION_TOKEN,
          }
        : undefined,
  });
}

export interface TranscriptionResult {
  fullTranscript: string;
  segments: TranscriptSegment[];
  durationMs: number;
  confidence: number;
}

// Shape of AWS Transcribe Medical output JSON
interface AwsTranscribeOutput {
  results: {
    transcripts: Array<{ transcript: string }>;
    items: Array<{
      type: "pronunciation" | "punctuation";
      alternatives: Array<{ confidence: string; content: string }>;
      start_time?: string;
      end_time?: string;
      speaker_label?: string;
    }>;
    speaker_labels?: {
      speakers: number;
      segments: Array<{
        speaker_label: string;
        start_time: string;
        end_time: string;
        items: Array<{ speaker_label: string; start_time: string; end_time: string }>;
      }>;
    };
  };
}

/**
 * Transcribe a pre-recorded audio file already uploaded to S3.
 *
 * Uses AWS Transcribe Medical (ca-central-1) — satisfies HIA / PIPEDA Canadian data residency.
 * Polls for job completion up to POLL_TIMEOUT_MS.
 */
export async function transcribeAudioFromS3(
  audioKey: string,
  encounterId: string,
): Promise<TranscriptionResult> {
  const bucket = process.env.AWS_S3_BUCKET ?? "specscribe-audio";
  const start = Date.now();

  // Derive audio format from key extension (S3 key ends in e.g. ".webm")
  const ext = audioKey.split(".").pop()?.toLowerCase() ?? "webm";
  const mediaFormat = (["mp3", "mp4", "wav", "flac", "ogg", "amr", "webm"].includes(ext)
    ? ext
    : "webm") as "mp3" | "mp4" | "wav" | "flac" | "ogg" | "amr" | "webm";

  const jobName = `specscribe-${uuidv4()}`;
  const outputKey = `transcripts/${jobName}.json`;

  logger.info("STT: starting AWS Transcribe Medical job", { encounterId, jobName });

  const transcribeClient = getTranscribeClient();

  await transcribeClient.send(
    new StartMedicalTranscriptionJobCommand({
      MedicalTranscriptionJobName: jobName,
      LanguageCode: "en-US",
      Media: { MediaFileUri: `s3://${bucket}/${audioKey}` },
      MediaFormat: mediaFormat,
      OutputBucketName: bucket,
      OutputKey: outputKey,
      // PRIMARYCARE covers general behavioral health vocabulary
      Specialty: "PRIMARYCARE",
      Type: "CONVERSATION",
      Settings: {
        ShowSpeakerLabels: true,
        MaxSpeakerLabels: 2, // provider + patient
      },
    }),
  );

  // Poll for completion — medical transcription typically finishes in 15–120s for short sessions
  const POLL_INTERVAL_MS = 4_000;
  const POLL_TIMEOUT_MS = 5 * 60 * 1_000; // 5 minutes max

  let jobStatus: TranscriptionJobStatus | string | undefined = "IN_PROGRESS";

  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const statusRes = await transcribeClient.send(
      new GetMedicalTranscriptionJobCommand({ MedicalTranscriptionJobName: jobName }),
    );

    jobStatus = statusRes.MedicalTranscriptionJob?.TranscriptionJobStatus;

    if (jobStatus === TranscriptionJobStatus.COMPLETED) break;
    if (jobStatus === TranscriptionJobStatus.FAILED) {
      const reason = statusRes.MedicalTranscriptionJob?.FailureReason ?? "unknown";
      throw new Error(`AWS Transcribe Medical job failed: ${reason}`);
    }

    logger.info("STT: transcription job in progress", { encounterId, jobName, jobStatus });
  }

  if (jobStatus !== TranscriptionJobStatus.COMPLETED) {
    throw new Error(`AWS Transcribe Medical job timed out after ${POLL_TIMEOUT_MS / 1000}s`);
  }

  // Fetch output JSON from S3
  const s3 = getS3Client();
  const outputObj = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: outputKey }),
  );

  const raw = await outputObj.Body?.transformToString("utf-8");
  if (!raw) throw new Error("Empty transcription output from S3");

  const parsed = JSON.parse(raw) as AwsTranscribeOutput;
  const fullTranscript = parsed.results.transcripts[0]?.transcript ?? "";
  const durationMs = Date.now() - start;

  // Build speaker-labelled segments from speaker_label segments
  const segments: TranscriptSegment[] = buildSegments(parsed);

  // Compute average confidence from pronunciation items
  const pronunciations = parsed.results.items.filter((i) => i.type === "pronunciation");
  const avgConfidence =
    pronunciations.length > 0
      ? pronunciations.reduce((sum, i) => sum + parseFloat(i.alternatives[0]?.confidence ?? "0"), 0) /
        pronunciations.length
      : 0;

  logger.info("STT: transcription complete", {
    encounterId,
    jobName,
    wordCount: fullTranscript.split(" ").length,
    durationMs,
    avgConfidence,
  });

  return {
    fullTranscript,
    segments,
    durationMs,
    confidence: avgConfidence,
  };
}

function buildSegments(output: AwsTranscribeOutput): TranscriptSegment[] {
  const speakerSegments = output.results.speaker_labels?.segments;
  if (!speakerSegments || speakerSegments.length === 0) {
    // No speaker labels — return single segment
    return [
      {
        speaker: "unknown",
        text: output.results.transcripts[0]?.transcript ?? "",
        startMs: 0,
        endMs: 0,
        confidence: 0,
      },
    ];
  }

  // Build a lookup: start_time → speaker_label from the per-item speaker labels
  const timeSpeakerMap = new Map<string, string>();
  for (const seg of speakerSegments) {
    for (const item of seg.items) {
      timeSpeakerMap.set(item.start_time, item.speaker_label);
    }
  }

  // Group consecutive items by speaker into segments
  const segments: TranscriptSegment[] = [];
  let currentSpeaker: string | null = null;
  let currentWords: string[] = [];
  let segStartMs = 0;
  let segEndMs = 0;
  let segConfidenceSum = 0;
  let segWordCount = 0;

  for (const item of output.results.items) {
    if (item.type === "punctuation") {
      if (currentWords.length > 0) {
        currentWords[currentWords.length - 1] += item.alternatives[0]?.content ?? "";
      }
      continue;
    }

    const speaker = item.speaker_label ?? timeSpeakerMap.get(item.start_time ?? "") ?? "spk_0";
    const word = item.alternatives[0]?.content ?? "";
    const conf = parseFloat(item.alternatives[0]?.confidence ?? "0");
    const startMs = Math.round(parseFloat(item.start_time ?? "0") * 1000);
    const endMs = Math.round(parseFloat(item.end_time ?? "0") * 1000);

    if (speaker !== currentSpeaker) {
      // Flush current segment
      if (currentSpeaker !== null && currentWords.length > 0) {
        segments.push({
          speaker: currentSpeaker === "spk_0" ? "provider" : "patient",
          text: currentWords.join(" "),
          startMs: segStartMs,
          endMs: segEndMs,
          confidence: segWordCount > 0 ? segConfidenceSum / segWordCount : 0,
        });
      }
      currentSpeaker = speaker;
      currentWords = [word];
      segStartMs = startMs;
      segEndMs = endMs;
      segConfidenceSum = conf;
      segWordCount = 1;
    } else {
      currentWords.push(word);
      segEndMs = endMs;
      segConfidenceSum += conf;
      segWordCount++;
    }
  }

  // Flush last segment
  if (currentSpeaker !== null && currentWords.length > 0) {
    segments.push({
      speaker: currentSpeaker === "spk_0" ? "provider" : "patient",
      text: currentWords.join(" "),
      startMs: segStartMs,
      endMs: segEndMs,
      confidence: segWordCount > 0 ? segConfidenceSum / segWordCount : 0,
    });
  }

  return segments;
}
