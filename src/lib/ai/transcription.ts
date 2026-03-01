import { createClient } from "@deepgram/sdk";
import type { TranscriptSegment } from "@/types/encounter";
import { logger } from "@/lib/utils/logger";

let _client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!_client) {
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) throw new Error("DEEPGRAM_API_KEY is not configured");
    _client = createClient(key);
  }
  return _client;
}

export interface TranscriptionResult {
  fullTranscript: string;
  segments: TranscriptSegment[];
  durationMs: number;
  confidence: number;
}

/** Transcribe a pre-recorded audio buffer */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string,
  encounterId: string,
): Promise<TranscriptionResult> {
  const client = getClient();
  const start = Date.now();

  logger.info("STT: transcribing audio", { encounterId });

  const { result, error } = await client.listen.prerecorded.transcribeFile(
    audioBuffer,
    {
      model: "nova-2-medical",     // Deepgram medical model
      smart_format: true,
      diarize: true,               // Speaker separation
      punctuate: true,
      utterances: true,
      language: "en",              // Generic English supports Canadian nuances
      mimetype: mimeType,
      // PIPEDA & HIA COMPLIANCE: NEVER allow data to be used for training or logging
      // @ts-ignore
      data_logging: false,
      // @ts-ignore
      redact: ["pci", "ssn"]
    }
  );

  if (error || !result) {
    throw new Error(`Deepgram transcription failed: ${error?.message ?? "unknown error"}`);
  }

  const channel = result.results?.channels?.[0];
  const alt = channel?.alternatives?.[0];

  if (!alt) throw new Error("No transcription result returned");

  const fullTranscript = alt.transcript ?? "";
  const durationMs = Date.now() - start;

  // Map Deepgram utterances to our segments
  const segments: TranscriptSegment[] = (result.results?.utterances ?? []).map((u) => ({
    speaker: u.speaker === 0 ? "provider" : "patient",
    text: u.transcript,
    startMs: Math.round((u.start ?? 0) * 1000),
    endMs: Math.round((u.end ?? 0) * 1000),
    confidence: u.confidence ?? 0,
  }));

  logger.info("STT: transcription complete", {
    encounterId,
    wordCount: fullTranscript.split(" ").length,
    durationMs,
    confidence: alt.confidence ?? 0,
  });

  return {
    fullTranscript,
    segments,
    durationMs,
    confidence: alt.confidence ?? 0,
  };
}
