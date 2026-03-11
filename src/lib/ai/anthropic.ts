import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "@/lib/utils/logger";
import { hashSHA256 } from "@/lib/db/encryption";
import {
  BASE_CLINICAL_SYSTEM_PROMPT,
  BEHAVIORAL_HEALTH_LAYER,
  CODING_SYSTEM_PROMPT,
} from "./prompts/base-system";
import { buildPriorAuthPrompt, PRIOR_AUTH_SYSTEM_PROMPT } from "./prompts/prior-auth";
import {
  STEP_THERAPY_SYSTEM_PROMPT,
  buildStepTherapyPrompt,
  ALBERTA_JUSTIFICATION_SYSTEM_PROMPT,
  buildAlbertaJustificationPrompt,
} from "./prompts/step-therapy";
import type {
  GenerateNoteInput,
  GenerateNoteOutput,
  SuggestCodesOutput,
} from "@/types/encounter";
import type { StepTherapyEntry, ClinicalJustification, AlbertaPayerPreset, PayerSpecificData } from "@/types/prior-auth";
import type { SpecialtyType, NoteType, NoteFormat } from "@prisma/client";

/**
 * AI client — dual-mode:
 *   1. Direct Anthropic API: if ANTHROPIC_API_KEY is set (requires @anthropic-ai/sdk to be installed)
 *   2. AWS Bedrock (ca-central-1): fallback — always available with BEDROCK_* vars
 *
 * PIPEDA/HIA compliance: PHI minimized (age/sex/diagnoses only, no names or PHNs).
 */

// ── Identifier redaction ──────────────────────────────────────────────────────

export function stripCanadianIdentifiers(transcript: string): string {
  let s = transcript.replace(/\b[A-Z]{1,3}\d{6,10}\b/g, "[PHN-REDACTED]");
  s = s.replace(/\b\d{9,10}\b/g, "[PHN-REDACTED]");
  return s;
}

// ── Robust JSON parser ────────────────────────────────────────────────────────

/**
 * Escape ALL control characters (U+0000–U+001F) that appear inside JSON string
 * values. Claude occasionally emits multi-line strings or other control chars
 * without escaping them, breaking JSON.parse with errors like
 * "Expected ',' or ']' after array element".
 */
function repairJsonControlChars(s: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const char of s) {
    if (escaped) { out += char; escaped = false; continue; }
    if (char === "\\") { out += char; escaped = true; continue; }
    if (char === '"') { inString = !inString; out += char; continue; }
    if (inString) {
      const code = char.charCodeAt(0);
      if (code < 0x20) {
        if (char === "\n") { out += "\\n"; continue; }
        if (char === "\r") { out += "\\r"; continue; }
        if (char === "\t") { out += "\\t"; continue; }
        if (char === "\b") { out += "\\b"; continue; }
        if (char === "\f") { out += "\\f"; continue; }
        // Any other control character — emit as Unicode escape
        out += `\\u${code.toString(16).padStart(4, "0")}`;
        continue;
      }
    }
    out += char;
  }
  return out;
}

/**
 * Find the index of the closing `}` that matches the `{` at `start`,
 * correctly handling nested objects and string values with brace characters.
 * Returns -1 if no matching brace is found.
 */
function findJsonObjectEnd(s: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const char = s[i];
    if (escaped) { escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (!inString) {
      if (char === "{") depth++;
      if (char === "}") { depth--; if (depth === 0) return i; }
    }
  }
  return -1;
}

/**
 * Extract and parse a JSON object from an AI response.
 * Strips markdown code fences, finds the outermost { } via brace-depth
 * tracking (so trailing text with braces doesn't confuse extraction),
 * repairs unescaped control chars inside strings, then parses.
 */
function parseAIJsonObject<T>(text: string): T {
  // Remove ``` code fences (e.g. ```json ... ```)
  let s = text.replace(/^```(?:json)?[ \t]*/gim, "").replace(/^```[ \t]*$/gim, "");
  const firstBrace = s.indexOf("{");
  if (firstBrace === -1) throw new Error("No JSON object found in AI response");
  const endBrace = findJsonObjectEnd(s, firstBrace);
  if (endBrace === -1) throw new Error("Unclosed JSON object in AI response");
  s = s.substring(firstBrace, endBrace + 1);
  try {
    return JSON.parse(s) as T;
  } catch (firstErr) {
    try {
      return JSON.parse(repairJsonControlChars(s)) as T;
    } catch (secondErr) {
      // Log structure info only — no PHI values
      console.error("[AI] JSON parse failed after repair", {
        firstError: String(firstErr),
        secondError: String(secondErr),
        responseLength: s.length,
        responsePrefix: s.slice(0, 120).replace(/[\n\r]/g, " "),
      });
      throw secondErr;
    }
  }
}

/**
 * Same as parseAIJsonObject but for a top-level JSON array [ ... ].
 */
function parseAIJsonArray<T>(text: string): T[] {
  let s = text.replace(/^```(?:json)?[ \t]*/gim, "").replace(/^```[ \t]*$/gim, "");
  const firstBracket = s.indexOf("[");
  const lastBracket = s.lastIndexOf("]");
  if (firstBracket === -1 || lastBracket === -1) return [];
  s = s.substring(firstBracket, lastBracket + 1);
  try {
    return JSON.parse(s) as T[];
  } catch {
    return JSON.parse(repairJsonControlChars(s)) as T[];
  }
}

// ── Code format validation ────────────────────────────────────────────────────

export function isValidCodeFormat(codeType: string, code: string): boolean {
  if (codeType === "ICD10_CA") return /^[A-Z]\d{2}(\.[A-Z0-9]{1,2})?$/.test(code);
  if (codeType === "AHCIP") return /^[A-Z0-9]{2,8}$/i.test(code);
  return false;
}

// ── Client + model ────────────────────────────────────────────────────────────

let _bedrock: AnthropicBedrock | null = null;

function getBedrockClient(): AnthropicBedrock {
  if (!_bedrock) {
    const region = process.env.BEDROCK_AWS_REGION;
    if (!region) throw new Error("BEDROCK_AWS_REGION is not set");
    const ak = process.env.BEDROCK_AWS_ACCESS_KEY_ID;
    const sk = process.env.BEDROCK_AWS_SECRET_ACCESS_KEY;
    _bedrock =
      ak && sk
        ? new AnthropicBedrock({ awsRegion: region, awsAccessKey: ak, awsSecretKey: sk, awsSessionToken: process.env.BEDROCK_AWS_SESSION_TOKEN })
        : new AnthropicBedrock({ awsRegion: region });
  }
  return _bedrock;
}

function getModel(): string {
  if (process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
  }
  return process.env.BEDROCK_MODEL_ID ?? "anthropic.claude-3-haiku-20240307-v1:0";
}

type ClaudeResponse = {
  content: Array<{ type: string; text?: string }>;
  usage: { input_tokens: number; output_tokens: number };
};

async function callClaude(params: {
  model: string;
  max_tokens: number;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<ClaudeResponse> {
  if (process.env.ANTHROPIC_API_KEY) {
    console.log("[AI] CALL CLAUDE (Direct SDK):", { model: params.model, tokens: params.max_tokens });
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return client.messages.create(params) as Promise<ClaudeResponse>;
  }
  console.log("[AI] CALL CLAUDE (Bedrock):", { model: params.model });
  return getBedrockClient().messages.create(params) as Promise<ClaudeResponse>;
}

// ── Prompts ───────────────────────────────────────────────────────────────────

function buildSystemPrompt(
  specialty: SpecialtyType,
  _noteType: NoteType,
  _noteFormat: NoteFormat,
): string {
  let prompt = BASE_CLINICAL_SYSTEM_PROMPT;
  if (specialty === "behavioral_health") prompt += "\n" + BEHAVIORAL_HEALTH_LAYER;
  return prompt;
}

function buildNotePrompt(input: GenerateNoteInput, specialty: SpecialtyType): string {
  const ctx = input.patientContext;
  const ctxBlockContent = ctx
    ? `Age: ${ctx.ageYears ?? "unknown"}
Biological sex: ${ctx.biologicalSex ?? "unknown"}
Chief complaint: ${ctx.chiefComplaint ?? "not specified"}
Current diagnoses: ${ctx.priorDiagnoses?.join(", ") ?? "none documented"}
Current medications: ${ctx.currentMedications?.join(", ") ?? "none documented"}`
    : "";

  let ctxBlock = `EXACT ENCOUNTER DATA (Use these explicit values in your document header):
Patient Name: <span class="readonly-value">${input.patientName ?? "Unknown"}</span>
Rendering Provider: <span class="readonly-value">${input.providerName ?? "Unknown"}</span>
Encounter Date: <span class="readonly-value">${input.encounterDate ?? "Unknown"}</span>
Session Duration: <span class="readonly-value">${input.sessionDurationMinutes ? `${input.sessionDurationMinutes} minutes` : "Unknown"}</span>

PATIENT CONTEXT (demographics only — no identifiers):
${ctxBlockContent}`;

  if (ctx?.historicalContext) {
    ctxBlock += `\n\nHISTORICAL CONTEXT (Past encounters):\n${ctx.historicalContext}`;
  }

  const redacted = stripCanadianIdentifiers(input.transcript);

  return `Generate a ${input.noteFormat} ${input.noteType.replace("_", " ")} from the following clinical encounter transcript.

${ctxBlock}

TRANSCRIPT:
<transcript>
${redacted}
</transcript>

Requirements:
- Format: ${input.noteFormat}
- Note type: ${input.noteType.replace("_", " ")}
- Be comprehensive but concise
- Include all required clinical elements
- Use professional medical language
- Flag [MISSING: element name] for any required elements not found in the transcript
- RETURN THE NOTE AS FORMATTED HTML. Do not wrap in markdown \`\`\`html tags, just return the raw HTML string.
- Your output must begin exactly like this:
  <h1>[Note Title, e.g., PSYCHIATRIC PROGRESS NOTE — SOAP FORMAT]</h1>
  ${input.clinicName ? `<h2>${input.clinicName} | ${specialty.replace("_", " ")}</h2>` : `<h2>${specialty.replace("_", " ")}</h2>`}
- Use explicit HTML structure to organize the data into form-like fields:
  - Use <h3> for main clinical sections (e.g., "Subjective", "Objective").
  - Use <p><strong>Field Name:</strong> Field Value</p> for discrete data points.
  - Use <ul> and <li> for lists of symptoms or plans.
  - Present the data extensively organized, easy to read at a glance.`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generateClinicalNote(
  input: GenerateNoteInput,
  specialty: SpecialtyType,
  noteFormat: NoteFormat,
  encounterId: string,
): Promise<GenerateNoteOutput> {
  const model = getModel();
  const start = Date.now();

  const systemPrompt = buildSystemPrompt(specialty, input.noteType, noteFormat);
  const userPrompt = buildNotePrompt(input, specialty);
  const promptHash = hashSHA256(systemPrompt + userPrompt);

  logger.info("AI: generating clinical note", { encounterId, noteType: input.noteType });

  const response = await callClaude({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const latencyMs = Date.now() - start;
  const content = response.content[0];
  if (!content || content.type !== "text") throw new Error("Unexpected response type from AI");

  const note = content.text ?? "";
  const wordCount = note.split(/\s+/).filter(Boolean).length;

  logger.info("AI: note generated", {
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

  const response = await callClaude({
    model,
    max_tokens: 4096,
    system: CODING_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const latencyMs = Date.now() - start;
  const content = response.content[0];
  if (!content || content.type !== "text") throw new Error("Unexpected response type from AI");

  const textOutput = content.text ?? "";
  const parsed = parseAIJsonObject<Omit<SuggestCodesOutput, "modelVersion" | "inputTokens" | "outputTokens" | "latencyMs">>(textOutput);

  const validSuggestions = parsed.suggestions.filter((s) => isValidCodeFormat(s.codeType, s.code));
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

// ── Step therapy & Alberta justification ─────────────────────────────────────

export async function generateStepTherapyAnalysis(params: {
  notes: string[];
  encounterId: string;
}): Promise<Omit<StepTherapyEntry, "id" | "isAiGenerated">[]> {
  const model = getModel();
  const start = Date.now();
  const prompt = buildStepTherapyPrompt(params.notes);

  logger.info("AI: generating step therapy analysis", { encounterId: params.encounterId });

  const response = await callClaude({
    model,
    max_tokens: 2048,
    system: STEP_THERAPY_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const latencyMs = Date.now() - start;
  const content = response.content[0];
  if (!content || content.type !== "text") throw new Error("Unexpected response type from AI");

  const text = content.text ?? "";
  let parsed: Omit<StepTherapyEntry, "id" | "isAiGenerated">[];
  try {
    parsed = parseAIJsonArray<Omit<StepTherapyEntry, "id" | "isAiGenerated">>(text);
  } catch {
    logger.warn("AI: step therapy returned unparseable array", { encounterId: params.encounterId });
    parsed = [];
  }

  logger.info("AI: step therapy analysis complete", {
    encounterId: params.encounterId,
    entryCount: parsed.length,
    latencyMs,
  });

  return parsed;
}

export async function generateAlbertaJustification(params: {
  payerName: string;
  payerPreset: AlbertaPayerPreset;
  procedureCodes: string[];
  diagnosisCodes: string[];
  clinicalNote: string;
  stepTherapy: Pick<StepTherapyEntry, "drugOrTherapy" | "duration" | "reasonForFailure">[];
  payerData: PayerSpecificData;
  encounterId: string;
}): Promise<ClinicalJustification> {
  const model = getModel();
  const start = Date.now();

  const stepTherapySummary = params.stepTherapy
    .map((e) => `• ${e.drugOrTherapy}: ${e.duration} — ${e.reasonForFailure}`)
    .join("\n");

  const userPrompt = buildAlbertaJustificationPrompt({
    payerName: params.payerName,
    payerPreset: params.payerPreset,
    procedureCodes: params.procedureCodes,
    diagnosisCodes: params.diagnosisCodes,
    clinicalNote: params.clinicalNote,
    stepTherapySummary,
    payerData: params.payerData as Record<string, unknown>,
  });

  logger.info("AI: generating Alberta clinical justification", { encounterId: params.encounterId });

  const response = await callClaude({
    model,
    max_tokens: 4096,
    system: ALBERTA_JUSTIFICATION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const latencyMs = Date.now() - start;
  const content = response.content[0];
  if (!content || content.type !== "text") throw new Error("Unexpected response type from AI");

  const text = content.text ?? "";
  const result = parseAIJsonObject<ClinicalJustification>(text);

  logger.info("AI: Alberta justification complete", {
    encounterId: params.encounterId,
    dsmCodeCount: result.dsmCodes?.length ?? 0,
    missingDocCount: result.missingDocumentation?.length ?? 0,
    latencyMs,
  });

  return {
    clinicalSummary: result.clinicalSummary ?? "",
    medicalNecessityStatement: result.medicalNecessityStatement ?? "",
    dsmCodes: Array.isArray(result.dsmCodes) ? result.dsmCodes : [],
    missingDocumentation: Array.isArray(result.missingDocumentation) ? result.missingDocumentation : [],
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
  const model = getModel();

  try {
    console.log("[AI-PA] Starting generation with max_tokens: 4096");
    const response = await callClaude({
      model,
      max_tokens: 4096,
      system: PRIOR_AUTH_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildPriorAuthPrompt(params) }],
    });

    const content = response.content[0];
    if (!content || content.type !== "text") throw new Error("Unexpected response type from AI");

    const textOutput = content.text ?? "";
    return parseAIJsonObject<{ clinicalSummary: string; medicalNecessityStatement: string; missingDocumentation: string[] }>(textOutput);
  } catch (err: any) {
    console.error("[AI-PA] Generation Error:", err);
    throw err;
  }
}
