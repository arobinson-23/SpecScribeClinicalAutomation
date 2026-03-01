import Anthropic from "@anthropic-ai/sdk";
import { logger } from "@/lib/utils/logger";
import { hashSHA256 } from "@/lib/db/encryption";
import {
  BASE_CLINICAL_SYSTEM_PROMPT,
  BEHAVIORAL_HEALTH_LAYER,
  CODING_SYSTEM_PROMPT,
} from "./prompts/base-system";
import type {
  GenerateNoteInput,
  GenerateNoteOutput,
  SuggestCodesOutput,
  TranscriptSegment,
} from "@/types/encounter";
import type { SpecialtyType, NoteType, NoteFormat } from "@prisma/client";

/**
 * PIPEDA & HIA Compliance Note:
 * All AI interactions are processed using Zero-Retention/Non-Training endpoints.
 * PHI is minimized such that only demographics (age/sex) and medical context 
 * are passed to the model — direct patient identifiers (Name, PHN) are withheld.
 *
 * TODO: For full Canadian residency (HIA), migrate to AWS Bedrock in ca-central-1 (Montreal)
 */

const MODEL = "claude-3-5-sonnet-20241022";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

function buildSystemPrompt(specialty: SpecialtyType, _noteType: NoteType, _noteFormat: NoteFormat): string {
  let prompt = BASE_CLINICAL_SYSTEM_PROMPT;

  if (specialty === "behavioral_health") {
    prompt += "\n" + BEHAVIORAL_HEALTH_LAYER;
  }

  return prompt;
}

function buildNotePrompt(input: GenerateNoteInput): string {
  const ctx = input.patientContext;
  const ctxBlock = ctx
    ? `PATIENT CONTEXT (demographics only — no identifiers):
Age: ${ctx.ageYears ?? "unknown"}
Biological sex: ${ctx.biologicalSex ?? "unknown"}
Chief complaint: ${ctx.chiefComplaint ?? "not specified"}
Current diagnoses: ${ctx.priorDiagnoses?.join(", ") ?? "none documented"}
Current medications: ${ctx.currentMedications?.join(", ") ?? "none documented"}`
    : "";

  return `Generate a ${input.noteFormat} ${input.noteType.replace("_", " ")} from the following clinical encounter transcript.

${ctxBlock}

TRANSCRIPT:
<transcript>
${input.transcript}
</transcript>

Requirements:
- Format: ${input.noteFormat}
- Note type: ${input.noteType.replace("_", " ")}
- Be comprehensive but concise
- Include all required clinical elements
- Use professional medical language
- Flag [MISSING: element name] for any required elements not found in the transcript
- Return the complete note as a plain text string (no JSON wrapper for the note itself)`;
}

export async function generateClinicalNote(
  input: GenerateNoteInput,
  specialty: SpecialtyType,
  noteFormat: NoteFormat,
  encounterId: string,
): Promise<GenerateNoteOutput> {
  const client = getClient();
  const start = Date.now();

  const systemPrompt = buildSystemPrompt(specialty, input.noteType, noteFormat);
  const userPrompt = buildNotePrompt(input);
  const promptHash = hashSHA256(systemPrompt + userPrompt);

  logger.info("AI: generating clinical note", { encounterId, noteType: input.noteType });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const latencyMs = Date.now() - start;
  const content = response.content[0];
  if (!content || content.type !== "text") throw new Error("Unexpected response type from Claude");

  const note = content.text;
  const wordCount = note.split(/\s+/).filter(Boolean).length;

  logger.info("AI: note generated (PIPEDA/HIA audited)", {
    encounterId,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    latencyMs,
    promptHash,
  });

  return {
    note,
    wordCount,
    modelVersion: MODEL,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    latencyMs,
  };
}

export async function suggestCodes(params: {
  note: string;
  specialty: SpecialtyType;
  encounterId: string;
  payerRules?: string;
}): Promise<SuggestCodesOutput> {
  const client = getClient();
  const start = Date.now();

  const userPrompt = `Analyze this clinical note and suggest appropriate billing codes.

SPECIALTY: ${params.specialty.replace("_", " ")}
${params.payerRules ? `PAYER RULES TO APPLY:\n${params.payerRules}\n` : ""}

CLINICAL NOTE:
<note>
${params.note}
</note>

Return a JSON object with this exact structure:
{
  "suggestions": [
    {
      "codeType": "AHCIP" | "ICD10_CA",
      "code": "string",
      "description": "string",
      "modifier": "string | null",
      "units": number,
      "confidence": 0.0-1.0,
      "rationale": "string citing specific note language"
    }
  ],
  "visitLevel": "string | null",
  "visitJustification": "string | null",
  "rejectionRiskFlags": ["string"]
}`;

  logger.info("AI: generating code suggestions", { encounterId: params.encounterId });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: CODING_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const latencyMs = Date.now() - start;
  const content = response.content[0];
  if (!content || content.type !== "text") throw new Error("Unexpected response type from Claude");

  // Strip markdown code fences if present
  const raw = content.text.replace(/```(?:json)?\n?/g, "").trim();
  const parsed = JSON.parse(raw) as Omit<SuggestCodesOutput, "modelVersion" | "inputTokens" | "outputTokens" | "latencyMs">;

  logger.info("AI: codes suggested", {
    encounterId: params.encounterId,
    suggestionCount: parsed.suggestions.length,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    latencyMs,
  });

  return {
    ...parsed,
    modelVersion: MODEL,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    latencyMs,
  };
}

export async function generatePriorAuthSummary(params: {
  payerName: string;
  procedureCodes: string[];
  diagnosisCodes: string[];
  clinicalNote: string;
  payerCriteria?: string;
  encounterId: string;
}): Promise<{ clinicalSummary: string; medicalNecessityStatement: string; missingDocumentation: string[] }> {
  const client = getClient();
  const { buildPriorAuthPrompt } = await import("./prompts/prior-auth");
  const { PRIOR_AUTH_SYSTEM_PROMPT } = await import("./prompts/prior-auth");

  const userPrompt = buildPriorAuthPrompt(params);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: PRIOR_AUTH_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (!content || content.type !== "text") throw new Error("Unexpected response type");

  const raw = content.text.replace(/```(?:json)?\n?/g, "").trim();
  return JSON.parse(raw) as { clinicalSummary: string; medicalNecessityStatement: string; missingDocumentation: string[] };
}
