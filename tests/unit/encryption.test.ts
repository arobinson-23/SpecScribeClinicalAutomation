/**
 * PHI Encryption — 100% coverage of all exported functions.
 *
 * Dependencies: Node.js crypto only. No database. No network.
 * APP_SECRET is set to a valid 64-char hex value in tests/setup.ts.
 */
import { describe, it, expect } from "vitest";
import {
  encryptPHI,
  decryptPHI,
  decryptPHISafe,
  hashSHA256,
} from "@/lib/db/encryption";

// ── encryptPHI / decryptPHI roundtrip ────────────────────────────────────────

describe("encryptPHI → decryptPHI roundtrip", () => {
  it("returns the original ASCII plaintext", () => {
    const plaintext = "John Smith";
    expect(decryptPHI(encryptPHI(plaintext))).toBe(plaintext);
  });

  it("handles empty string", () => {
    const encrypted = encryptPHI("");
    expect(decryptPHI(encrypted)).toBe("");
  });

  it("handles Japanese characters (Unicode)", () => {
    const plaintext = "日本語テスト";
    expect(decryptPHI(encryptPHI(plaintext))).toBe(plaintext);
  });

  it("handles emoji (multi-byte Unicode)", () => {
    const plaintext = "🏥 Clinic 🩺";
    expect(decryptPHI(encryptPHI(plaintext))).toBe(plaintext);
  });

  it("handles a long clinical note string", () => {
    const plaintext = "Patient presents with recurring migraines. ".repeat(50);
    expect(decryptPHI(encryptPHI(plaintext))).toBe(plaintext);
  });

  it("produces JSON with ciphertext, iv, authTag, and keyVersion fields", () => {
    const encrypted = encryptPHI("test-value");
    const parsed: unknown = JSON.parse(encrypted);
    expect(parsed).toMatchObject({
      ciphertext: expect.any(String),
      iv: expect.any(String),
      authTag: expect.any(String),
      keyVersion: 1,
    });
  });
});

// ── Nonce uniqueness ─────────────────────────────────────────────────────────

describe("encryptPHI nonce uniqueness", () => {
  it("produces a different ciphertext on each call (random IV)", () => {
    const plaintext = "same input";
    const a = encryptPHI(plaintext);
    const b = encryptPHI(plaintext);
    // Same plaintext must produce different output (nonce is random)
    expect(a).not.toBe(b);
  });

  it("produces unique IVs across 20 encryptions of the same plaintext", () => {
    const ivs = new Set(
      Array.from({ length: 20 }, () => {
        const parsed = JSON.parse(encryptPHI("x")) as { iv: string };
        return parsed.iv;
      })
    );
    expect(ivs.size).toBe(20);
  });
});

// ── decryptPHI failure cases ─────────────────────────────────────────────────

describe("decryptPHI with invalid input", () => {
  it("throws when given a plain (non-JSON) string", () => {
    expect(() => decryptPHI("not-encrypted")).toThrow();
  });

  it("throws when the authTag has been tampered with (GCM auth failure)", () => {
    const encrypted = encryptPHI("sensitive");
    const parsed = JSON.parse(encrypted) as {
      ciphertext: string;
      iv: string;
      authTag: string;
      keyVersion: number;
    };
    // Flip the first character of the authTag
    parsed.authTag =
      parsed.authTag[0] === "A"
        ? "B" + parsed.authTag.slice(1)
        : "A" + parsed.authTag.slice(1);
    expect(() => decryptPHI(JSON.stringify(parsed))).toThrow();
  });

  it("throws when the ciphertext has been tampered with", () => {
    const encrypted = encryptPHI("sensitive");
    const parsed = JSON.parse(encrypted) as {
      ciphertext: string;
      iv: string;
      authTag: string;
      keyVersion: number;
    };
    // Corrupt the ciphertext
    parsed.ciphertext =
      parsed.ciphertext[0] === "A"
        ? "B" + parsed.ciphertext.slice(1)
        : "A" + parsed.ciphertext.slice(1);
    expect(() => decryptPHI(JSON.stringify(parsed))).toThrow();
  });
});

// ── decryptPHISafe ────────────────────────────────────────────────────────────

describe("decryptPHISafe", () => {
  it("returns the original plaintext for a valid ciphertext", () => {
    const plaintext = "Jane Doe";
    expect(decryptPHISafe(encryptPHI(plaintext))).toBe(plaintext);
  });

  it("returns null and does not throw for a plain (non-encrypted) string", () => {
    expect(() => decryptPHISafe("not-encrypted")).not.toThrow();
    expect(decryptPHISafe("not-encrypted")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(decryptPHISafe(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(decryptPHISafe(undefined)).toBeNull();
  });

  it("returns null for empty string input", () => {
    expect(decryptPHISafe("")).toBeNull();
  });

  it("returns null and does not throw for a tampered authTag", () => {
    const encrypted = encryptPHI("sensitive");
    const parsed = JSON.parse(encrypted) as {
      ciphertext: string;
      iv: string;
      authTag: string;
      keyVersion: number;
    };
    parsed.authTag =
      parsed.authTag[0] === "A"
        ? "B" + parsed.authTag.slice(1)
        : "A" + parsed.authTag.slice(1);
    const tampered = JSON.stringify(parsed);

    expect(() => decryptPHISafe(tampered)).not.toThrow();
    expect(decryptPHISafe(tampered)).toBeNull();
  });

  it("returns null and does not throw for random garbage bytes", () => {
    const garbage = Buffer.from("deadbeefcafebabe0102030405060708", "hex").toString("base64");
    expect(() => decryptPHISafe(garbage)).not.toThrow();
    expect(decryptPHISafe(garbage)).toBeNull();
  });
});

// ── hashSHA256 ────────────────────────────────────────────────────────────────

describe("hashSHA256", () => {
  it("returns a 64-character lowercase hex string", () => {
    const hash = hashSHA256("some input");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic: same input always produces the same output", () => {
    const input = "patient-id-12345";
    expect(hashSHA256(input)).toBe(hashSHA256(input));
    expect(hashSHA256(input)).toBe(hashSHA256(input));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashSHA256("input-A")).not.toBe(hashSHA256("input-B"));
  });

  it("hashes an empty string without throwing", () => {
    const hash = hashSHA256("");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is stable across calls: identical input produces identical 64-char hex", () => {
    const input = "encounter-id:abc-practice-id:xyz";
    const first = hashSHA256(input);
    const second = hashSHA256(input);
    const third = hashSHA256(input);
    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(first).toHaveLength(64);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });
});
