/**
 * Unit tests for src/lib/ai/anthropic.ts
 *
 * The @anthropic-ai/bedrock-sdk client is mocked via vi.hoisted so that no
 * real AWS Bedrock calls are made. All tests run offline.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Hoist mock so the factory runs before any imports ─────────────────────────
const mockMessagesCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/bedrock-sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockMessagesCreate },
  })),
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/db/encryption", () => ({
  hashSHA256: (s: string) => `sha256:${s.slice(0, 16)}`,
  encryptPHI: (s: string) => `enc(${s})`,
  decryptPHI: (s: string) => s.replace(/^enc\(/, "").replace(/\)$/, ""),
}));

// Ensure required env vars are present before the module is loaded
process.env.BEDROCK_AWS_REGION = "ca-central-1";
process.env.BEDROCK_AWS_ACCESS_KEY_ID = "test-access-key";
process.env.BEDROCK_AWS_SECRET_ACCESS_KEY = "test-secret-key";
process.env.BEDROCK_MODEL_ID = "anthropic.claude-sonnet-4-5:0";

// Prompts modules are simple string exports — mock with minimal values
vi.mock("@/lib/ai/prompts/base-system", () => ({
  BASE_CLINICAL_SYSTEM_PROMPT: "Base clinical prompt.",
  BEHAVIORAL_HEALTH_LAYER: "Behavioral health layer.",
  CODING_SYSTEM_PROMPT: "Coding system prompt.",
}));

import {
  generateClinicalNote,
  suggestCodes,
  stripCanadianIdentifiers,
  isValidCodeFormat,
} from "@/lib/ai/anthropic";

// ── Shared fixture ────────────────────────────────────────────────────────────

const NOTE_INPUT = {
  encounterId: "enc-test-001",
  transcript: "Provider: How are you feeling today? Patient: Much better.",
  noteType: "progress_note" as const,
  noteFormat: "SOAP" as const,
};

function makeNoteResponse(text: string) {
  return {
    content: [{ type: "text", text }],
    usage: { input_tokens: 120, output_tokens: 80 },
  };
}

function makeCodesResponse(suggestions: unknown[]) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          suggestions,
          visitLevel: null,
          visitJustification: null,
          rejectionRiskFlags: [],
        }),
      },
    ],
    usage: { input_tokens: 150, output_tokens: 100 },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("generateClinicalNote", () => {
  beforeEach(() => {
    mockMessagesCreate.mockResolvedValue(
      makeNoteResponse("SUBJECTIVE: Patient reports improvement.\n\nOBJECTIVE: Vitals stable.")
    );
  });

  it("returns a non-empty note string", async () => {
    const result = await generateClinicalNote(
      NOTE_INPUT,
      "behavioral_health",
      "SOAP",
      "enc-test-001"
    );

    expect(typeof result.note).toBe("string");
    expect(result.note.length).toBeGreaterThan(0);
  });

  it("populates token counts and latency from the mock response", async () => {
    const result = await generateClinicalNote(
      NOTE_INPUT,
      "behavioral_health",
      "SOAP",
      "enc-test-001"
    );

    expect(result.inputTokens).toBe(120);
    expect(result.outputTokens).toBe(80);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("does not throw when called with valid input", async () => {
    await expect(
      generateClinicalNote(NOTE_INPUT, "behavioral_health", "SOAP", "enc-test-001")
    ).resolves.not.toThrow();
  });
});

describe("suggestCodes — valid format codes pass through", () => {
  const VALID_SUGGESTION = {
    codeType: "ICD10_CA",
    code: "F41.1",
    description: "Generalized anxiety disorder",
    modifier: null,
    units: 1,
    confidence: 0.92,
    rationale: "Patient reports persistent worry",
  };

  beforeEach(() => {
    mockMessagesCreate.mockResolvedValue(makeCodesResponse([VALID_SUGGESTION]));
  });

  it("returns an array with at least one element", async () => {
    const result = await suggestCodes({
      note: "Patient reports generalized anxiety.",
      specialty: "behavioral_health",
      encounterId: "enc-test-001",
    });

    expect(Array.isArray(result.suggestions)).toBe(true);
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
  });

  it("each suggestion has code, description, and numeric confidence", async () => {
    const result = await suggestCodes({
      note: "Patient reports generalized anxiety.",
      specialty: "behavioral_health",
      encounterId: "enc-test-001",
    });

    for (const s of result.suggestions) {
      expect(typeof s.code).toBe("string");
      expect(typeof s.description).toBe("string");
      expect(typeof s.confidence).toBe("number");
      expect(s.confidence).toBeGreaterThanOrEqual(0);
      expect(s.confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe("suggestCodes — hallucination guard", () => {
  // Small whitelist of valid behavioral health ICD-10-CA codes used in assertions
  const VALID_BH_CODES = new Set([
    "F32.0", "F32.1", "F33.0", "F33.1",
    "F41.0", "F41.1", "F40.10",
    "F43.10", "F43.12",
    "Z71.89",
  ]);

  it("filters out a fake code (Z99.999) with 3 decimal digits", async () => {
    const validSuggestion = {
      codeType: "ICD10_CA",
      code: "F41.1",
      description: "Generalized anxiety disorder",
      modifier: null,
      units: 1,
      confidence: 0.9,
      rationale: "Patient reports persistent worry",
    };
    const fakeSuggestion = {
      codeType: "ICD10_CA",
      code: "Z99.999",
      description: "Invented code",
      modifier: null,
      units: 1,
      confidence: 0.5,
      rationale: "Hallucinated",
    };

    mockMessagesCreate.mockResolvedValue(
      makeCodesResponse([validSuggestion, fakeSuggestion])
    );

    const result = await suggestCodes({
      note: "Progress note content.",
      specialty: "behavioral_health",
      encounterId: "enc-test-001",
    });

    const returnedCodes = result.suggestions.map((s) => s.code);

    // The fake code must be absent
    expect(returnedCodes).not.toContain("Z99.999");

    // The valid code must be present
    expect(returnedCodes).toContain("F41.1");

    // All returned codes should be in the known valid set for this test
    for (const code of returnedCodes) {
      expect(VALID_BH_CODES.has(code)).toBe(true);
    }
  });
});

describe("generateClinicalNote — latency SLA", () => {
  it("resolves in under 15 000 ms when the mock responds instantly", async () => {
    mockMessagesCreate.mockResolvedValue(makeNoteResponse("Note content."));

    const start = Date.now();
    await generateClinicalNote(
      NOTE_INPUT,
      "behavioral_health",
      "SOAP",
      "enc-test-sla"
    );
    const elapsed = Date.now() - start;

    // The function should complete almost immediately with a mock.
    // The SLA threshold documents the production requirement.
    expect(elapsed).toBeLessThan(15_000);
  });
});

describe("generateClinicalNote — PHI minimization", () => {
  it("strips a Canadian PHN from the transcript before sending to the model", async () => {
    const phn = "AB12345678"; // 2-letter prefix + 8 digits — common test pattern
    const transcriptWithPHN = `Provider: Good morning. Patient PHN is ${phn}. How are you feeling?`;

    mockMessagesCreate.mockResolvedValue(makeNoteResponse("Redacted note."));

    await generateClinicalNote(
      { ...NOTE_INPUT, transcript: transcriptWithPHN },
      "behavioral_health",
      "SOAP",
      "enc-phi-test"
    );

    expect(mockMessagesCreate).toHaveBeenCalledOnce();

    // Inspect every argument passed to messages.create
    const callArgs = mockMessagesCreate.mock.calls[0] as unknown[];
    const serialised = JSON.stringify(callArgs);

    // The raw PHN must not appear in any prompt sent to the model
    expect(serialised).not.toContain(phn);
  });
});

describe("stripCanadianIdentifiers (unit)", () => {
  it("redacts letter-prefix PHN patterns", () => {
    expect(stripCanadianIdentifiers("PHN: AB12345678")).toContain("[PHN-REDACTED]");
    expect(stripCanadianIdentifiers("PHN: AB12345678")).not.toContain("AB12345678");
  });

  it("redacts standalone 9-digit sequences", () => {
    expect(stripCanadianIdentifiers("ID: 123456789")).toContain("[PHN-REDACTED]");
  });

  it("redacts standalone 10-digit sequences", () => {
    expect(stripCanadianIdentifiers("ID: 1234567890")).toContain("[PHN-REDACTED]");
  });

  it("preserves normal clinical text", () => {
    const text = "Patient reports F41.1 anxiety, BP 120/80, HR 72 bpm.";
    expect(stripCanadianIdentifiers(text)).toBe(text);
  });
});

describe("isValidCodeFormat (unit)", () => {
  it("accepts valid ICD-10-CA format codes", () => {
    expect(isValidCodeFormat("ICD10_CA", "F41.1")).toBe(true);
    expect(isValidCodeFormat("ICD10_CA", "F40.10")).toBe(true);
    expect(isValidCodeFormat("ICD10_CA", "Z99.1")).toBe(true);
    expect(isValidCodeFormat("ICD10_CA", "F32")).toBe(true); // no decimal — valid
  });

  it("rejects ICD-10-CA codes with 3+ decimal characters (hallucinated format)", () => {
    expect(isValidCodeFormat("ICD10_CA", "Z99.999")).toBe(false);
    expect(isValidCodeFormat("ICD10_CA", "F41.123")).toBe(false);
  });

  it("rejects completely malformed codes", () => {
    expect(isValidCodeFormat("ICD10_CA", "")).toBe(false);
    expect(isValidCodeFormat("ICD10_CA", "INVALID")).toBe(false);
  });

  it("accepts reasonable AHCIP codes", () => {
    expect(isValidCodeFormat("AHCIP", "03.04A")).toBe(false); // dot not in AHCIP pattern
    expect(isValidCodeFormat("AHCIP", "0304A")).toBe(true);
  });
});
