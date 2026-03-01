import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

// ── S3 client (same config as transcribe route) ───────────────────────────────

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "ca-central-1",
  ...(process.env.AWS_ENDPOINT_URL
    ? { endpoint: process.env.AWS_ENDPOINT_URL, forcePathStyle: true }
    : {}),
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  },
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PdfFileEntry {
  filename: string;          // original filename without extension
  inferredFirstName: string; // from Firstname_Lastname.pdf pattern
  inferredLastName: string;
  pdfBytes: Uint8Array;      // raw PDF bytes from ZIP
}

export interface UploadResult {
  filename: string;
  patientId: string;
  s3Key: string;
  status: "success" | "no_match" | "error";
  errorMessage?: string;
}

// ── PDF metadata stripping ────────────────────────────────────────────────────

/**
 * Strips all identifying metadata from a PDF document.
 * Clears Author, Title, Subject, Creator, Producer, Keywords, and XMP stream.
 * Sets creation/modification dates to epoch to prevent implicit re-identification.
 */
export async function stripPdfMetadata(pdfBytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  // Clear standard document info dictionary fields
  doc.setTitle("");
  doc.setAuthor("");
  doc.setSubject("");
  doc.setCreator("SpecScribe Migration");
  doc.setProducer("SpecScribe");
  doc.setKeywords([]);

  // Set dates to epoch (minimise temporal re-identification risk)
  const epoch = new Date(0);
  doc.setCreationDate(epoch);
  doc.setModificationDate(epoch);

  // Remove XMP metadata stream entirely (contains extended metadata like
  // document history, software fingerprints, and custom schemas)
  const catalog = doc.catalog;
  if (catalog.has(doc.context.obj("Metadata") as unknown as Parameters<typeof catalog.has>[0])) {
    catalog.delete(doc.context.obj("Metadata") as unknown as Parameters<typeof catalog.delete>[0]);
  }

  return doc.save();
}

// ── ZIP extraction ────────────────────────────────────────────────────────────

/**
 * Extracts all .pdf files from a ZIP buffer.
 * Parses filenames as `Firstname_Lastname.pdf` → { inferredFirstName, inferredLastName }.
 * Ignores macOS __MACOSX artefacts.
 */
export async function extractPdfsFromZip(zipBuffer: ArrayBuffer): Promise<PdfFileEntry[]> {
  const zip = await JSZip.loadAsync(zipBuffer);
  const entries: PdfFileEntry[] = [];

  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    if (path.startsWith("__MACOSX")) continue;

    const basename = path.split("/").pop() ?? path;
    if (!basename.toLowerCase().endsWith(".pdf")) continue;

    const nameWithoutExt = basename.slice(0, -4); // strip .pdf
    const parts = nameWithoutExt.split("_");

    // Expect at least Firstname_Lastname; extra parts treated as compound last name
    const inferredFirstName = parts[0]?.trim() ?? "";
    const inferredLastName = parts.slice(1).join(" ").trim();

    if (!inferredFirstName || !inferredLastName) continue; // skip malformed names

    const pdfBytes = await file.async("uint8array");
    entries.push({ filename: nameWithoutExt, inferredFirstName, inferredLastName, pdfBytes });
  }

  return entries;
}

// ── Patient name matching ─────────────────────────────────────────────────────

/**
 * Case-insensitive, trimmed exact match on decrypted first + last name.
 * Returns the matched patient ID or null.
 */
export function matchPatientByName(
  inferredFirstName: string,
  inferredLastName: string,
  decryptedPatients: Array<{ id: string; firstName: string; lastName: string }>
): string | null {
  const first = inferredFirstName.toLowerCase().trim();
  const last = inferredLastName.toLowerCase().trim();

  const match = decryptedPatients.find(
    (p) => p.firstName.toLowerCase().trim() === first && p.lastName.toLowerCase().trim() === last
  );

  return match?.id ?? null;
}

// ── S3 upload ─────────────────────────────────────────────────────────────────

/**
 * Uploads a stripped PDF to S3 under `{practiceId}/migration/{patientId}/{uuid}.pdf`.
 * Server-side AES-256 encryption is enforced via `ServerSideEncryption: "AES256"`.
 * No PHI is written into S3 object metadata.
 */
export async function uploadPdfToS3(
  pdfBytes: Uint8Array,
  practiceId: string,
  patientId: string
): Promise<string> {
  const key = `${practiceId}/migration/${patientId}/${uuidv4()}.pdf`;

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET ?? "specscribe-audio",
      Key: key,
      Body: Buffer.from(pdfBytes),
      ContentType: "application/pdf",
      ServerSideEncryption: "AES256",
      // No PHI in S3 metadata — only opaque IDs
      Metadata: { practiceId, patientId },
    })
  );

  return key;
}
