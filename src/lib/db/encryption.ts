import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getDEK(): Buffer {
  const key = process.env.APP_SECRET;
  if (!key) throw new Error("APP_SECRET environment variable is not set");
  // Derive a 32-byte key from the secret
  return createHash("sha256").update(key).digest();
}

export interface EncryptedField {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

export function encryptPHI(plaintext: string): string {
  const dek = getDEK();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, dek, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let ciphertext = cipher.update(plaintext, "utf8", "base64");
  ciphertext += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  const field: EncryptedField = {
    ciphertext,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    keyVersion: 1,
  };

  return JSON.stringify(field);
}

export function decryptPHI(encryptedJson: string): string {
  const dek = getDEK();
  const field: EncryptedField = JSON.parse(encryptedJson);

  const decipher = createDecipheriv(
    ALGORITHM,
    dek,
    Buffer.from(field.iv, "base64"),
    { authTagLength: AUTH_TAG_LENGTH }
  );
  decipher.setAuthTag(Buffer.from(field.authTag, "base64"));

  let plaintext = decipher.update(field.ciphertext, "base64", "utf8");
  plaintext += decipher.final("utf8");
  return plaintext;
}

/** Safe decrypt — returns null instead of throwing if decryption fails */
export function decryptPHISafe(encryptedJson: string | null | undefined): string | null {
  if (!encryptedJson) return null;
  try {
    return decryptPHI(encryptedJson);
  } catch {
    return null;
  }
}

export function hashSHA256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
