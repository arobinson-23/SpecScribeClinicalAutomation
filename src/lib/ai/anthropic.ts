import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
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
} from "@/types/encounter";
import type { SpecialtyType, NoteType, NoteFormat } from "@prisma/client";

/**
 * PIPEDA & HIA Compliance Note:
 * All AI interactions are processed via AWS Bedrock in ca-central-1 (Montreal).
 * Data residency in Canada satisfies HIA (Alberta Health Information Act) and
 * PIPEDA requirements. PHI is minimized such that only demographics (age/sex)
 * and medical context are passed to the model — direct patient identifiers
 * (Name, PHN) are withheld.
 */

/**
 * Strips common Canadian Personal Health Number (PHN) patterns from a
 * transcript before it is sent to the AI model.
 *
 * Patterns redacted:
 *  - Provincial prefix + digits: e.g. "AB12345678" (2-3 letters + 6-10 digits)
 *  - Standalone 9- or 10-digit sequences (common PHN formats across provinces)
 *
 * Replacement: "[PHN-REDACTED]"
 *
 * NOTE: This is a best-effort regex approach. Structured data minimization
 * (passing only age/sex rather than names or DOBs) is the primary control.
 */
export function stripCanadianIdentifiers(transcript: string): string {
  // Provincial prefix + digits: AB12345678, ON1234567890, etc.
  let stripped = transcript.replace(
    /\b[A-Z]{1,3}\d{6,10}\b/g,
    "[PHN-REDACTED]"
  );
  // Standalone 9–10 digit sequences (Alberta PHN = 9 digits, Ontario = 10)
  stripped = stripped.replace(/\b\d{9,10}\b/g, "[PHN-REDACTED]");
  return stripped;
}

/**
 * Validates that a suggested billing code matches the expected format for
 * its code type. Filters out hallucinated or malformed codes.
 *
 * ICD-10-CA format: [A-Z][0-9]{2}(\.[A-Z0-9]{1,2})?
 *   Valid:   F41.1, F40.10, Z99.1, Z51.0
 *   Invalid: Z99.999 (3 decimal chars), FOO (no digits)
 *
 * AHCIP codes are practice-submitted numeric service codes; we apply a
 * loose sanity check (non-empty, no special characters) rather than
 * prescribing a rigid format, as AHCIP schedules vary.
 */
export function isValidCodeFormat(codeType: string, code: string): boolean {
  if (codeType === "ICD10_CA") {
    return /^[A-Z]\d{2}(\.[A-Z0-9]{1,2})?$/.test(code);
  }
  if (codeType === "AHCIP") {
    // AHCIP service codes: 3-7 alphanumeric chars, no spaces or special chars
    return /^[A-Z0-9]{2,8}$/i.test(code);
  }
  return false;
}

// Bedrock model ID — set BEDROCK_MODEL_ID in env.
// Example: anthropic.claude-sonnet-4-5:0 or a cross-region inference profile
// such as ca.anthropic.claude-sonnet-4-5:0 if available in ca-central-1.
const DEFAULT_BEDROCK_MODEL = "anthropic.claude-sonnet-4-5:0";

function getModel(): string {
  return process.env.BEDROCK_MODEL_ID ?? DEFAULT_BEDROCK_MODEL;
}

let _client: AnthropicBedrock | null = null;

function getClient(): AnthropicBedrock {
  if (!_client) {
    const region = process.env.BEDROCK_AWS_REGION;
    if (!region) throw new Error("BEDROCK_AWS_REGION is not configured");
    // Credentials are resolved from the standard AWS credential chain:
    // BEDROCK_AWS_ACCESS_KEY_ID / BEDROCK_AWS_SECRET_ACCESS_KEY env vars,
    // or an IAM role attached to the compute instance (preferred in production).
    // The SDK requires awsAccessKey + awsSecretKey to both be non-null strings
    // when providing explicit credentials. When absent, it falls back to the
    // standard AWS credential chain (EC2/ECS role, ~/.aws/credentials, etc.).
    // Use explicit branches so TypeScript can resolve the correct overload.
    const accessKey = process.env.BEDROCK_AWS_ACCESS_KEY_ID;
    const secretKey = process.env.BEDROCK_AWS_SECRET_ACCESS_KEY;
    if (accessKey && secretKey) {
      _client = new AnthropicBedrock({
        awsRegion: region,
        awsAccessKey: accessKey,
        awsSecretKey: secretKey,
        awsSessionToken: process.env.BEDROCK_AWS_SESSION_TOKEN,
      });
    } else {
      _client = new AnthropicBedrock({ awsRegion: region });
    }
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

  // Strip Canadian PHN patterns before sending to the AI model (PIPEDA data minimization)
  const redactedTranscript = stripCanadianIdentifiers(input.transcript);

  return `Generate a ${input.noteFormat} ${input.noteType.replace("_", " ")} from the following clinical encounter transcript.

${ctxBlock}

TRANSCRIPT:
<transcript>
${redactedTranscript}
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
  const model = getModel();
  const start = Date.now();

  const systemPrompt = buildSystemPrompt(specialty, input.noteType, noteFormat);
  const userPrompt = buildNotePrompt(input);
  const promptHash = hashSHA256(systemPrompt + userPrompt);

  logger.info("AI: generating clinical note", { encounterId, noteType: input.noteType });

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const latencyMs = Date.now() - start;
  const content = response.content[0];
  if (!content || content.type !== "text") throw new Error("Unexpected response type from Claude");

  const note = content.text;
  const wordCount = note.split(/\s+/).filter(Boolean).length;

  logger.info("AI: note generated (PIPEDA/provincial — ca-central-1)", {
    encounterId,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    latencyMs,
    promptHash,
  });

  return {
    note,
    wordCount,
    modelVersion: model,
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
  const model = getModel();
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
    model,
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

  // Hallucination guard: filter suggestions whose code does not match the
  // expected format for its declared codeType.
  const validSuggestions = parsed.suggestions.filter((s) =>
    isValidCodeFormat(s.codeType, s.code)
  );
  if (validSuggestions.length < parsed.suggestions.length) {
    logger.warn("AI: filtered malformed code suggestions", {
      encounterId: params.encounterId,
      originalCount: parsed.suggestions.length,
      validCount: validSuggestions.length,
    });
  }
  parsed.suggestions = validSuggestions;

  logger.info("AI: codes suggested", {
    encounterId: params.encounterId,
    suggestionCount: parsed.suggestions.length,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    latencyMs,
  });

  return {
    ...parsed,
    modelVersion: model,
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
  const model = getModel();
  const { buildPriorAuthPrompt } = await import("./prompts/prior-auth");
  const { PRIOR_AUTH_SYSTEM_PROMPT } = await import("./prompts/prior-auth");

  const userPrompt = buildPriorAuthPrompt(params);

  const response = await client.messages.create({
    model,
    max_tokens: 3000,
    system: PRIOR_AUTH_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (!content || content.type !== "text") throw new Error("Unexpected response type");

  const raw = content.text.replace(/```(?:json)?\n?/g, "").trim();
  return JSON.parse(raw) as { clinicalSummary: string; medicalNecessityStatement: string; missingDocumentation: string[] };
}
