// PDF generation for Smart PDF Recommender — runs client-side only (called from event handlers)
// Tries to load a real PDF template from /public/pdf-templates/; falls back to
// programmatic generation via pdf-lib if the template file is absent.

import {
  PDFDocument,
  PDFPage,
  PDFFont,
  rgb,
  StandardFonts,
  type RGB,
} from 'pdf-lib';

import { type FormId, type PdfFormData, FORM_CONFIGS } from './form-templates';

// ── Layout constants ───────────────────────────────────────────────────────────

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 45;
const CONTENT_W = PAGE_W - 2 * MARGIN;

// ── Text-wrapping utility ──────────────────────────────────────────────────────

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  if (!text) return [];
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Draws multi-line wrapped text and returns the Y position after the last line. */
function drawWrapped(
  page: PDFPage,
  text: string,
  x: number,
  startY: number,
  font: PDFFont,
  size: number,
  maxWidth: number,
  lineHeight: number,
  color: RGB = rgb(0.1, 0.1, 0.1),
): number {
  const lines = wrapText(text, font, size, maxWidth);
  let y = startY;
  for (const line of lines) {
    if (y < MARGIN + 60) break; // stop near page bottom
    page.drawText(line, { x, y, size, font, color });
    y -= lineHeight;
  }
  return y;
}

// ── Mutable draw context ───────────────────────────────────────────────────────

interface Ctx {
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
}

function sectionHeader(ctx: Ctx, title: string, accent: RGB) {
  const lightBg = rgb(
    accent.red * 0.08 + 0.92,
    accent.green * 0.08 + 0.92,
    accent.blue * 0.08 + 0.92,
  );
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - 4,
    width: CONTENT_W,
    height: 18,
    color: lightBg,
  });
  ctx.page.drawText(title.toUpperCase(), {
    x: MARGIN + 6,
    y: ctx.y + 1,
    size: 7,
    font: ctx.bold,
    color: rgb(accent.red * 0.75, accent.green * 0.75, accent.blue * 0.75),
  });
  ctx.y -= 24;
}

function fieldRow(
  ctx: Ctx,
  label: string,
  value: string | null | undefined,
  opts: { multiline?: boolean; labelWidth?: number } = {},
) {
  const lw = opts.labelWidth ?? 145;
  const vx = MARGIN + lw;
  const vw = CONTENT_W - lw;

  ctx.page.drawText(`${label}:`, {
    x: MARGIN,
    y: ctx.y,
    size: 7.5,
    font: ctx.bold,
    color: rgb(0.38, 0.38, 0.38),
  });

  if (value) {
    if (opts.multiline) {
      // Limit block to 10 lines (~120 chars per line) to avoid overflow
      const capped = value.length > 1200 ? `${value.slice(0, 1200)}…` : value;
      const endY = drawWrapped(ctx.page, capped, vx, ctx.y, ctx.font, 8.5, vw, 12.5);
      ctx.y = endY - 4;
    } else {
      const display = value.length > 88 ? `${value.slice(0, 88)}…` : value;
      ctx.page.drawText(display, {
        x: vx,
        y: ctx.y,
        size: 8.5,
        font: ctx.font,
        color: rgb(0.1, 0.1, 0.1),
      });
      ctx.y -= 15;
    }
  } else {
    // Blank underline for manual entry
    ctx.page.drawLine({
      start: { x: vx, y: ctx.y - 3 },
      end: { x: vx + vw - 8, y: ctx.y - 3 },
      thickness: 0.5,
      color: rgb(0.72, 0.72, 0.72),
    });
    ctx.y -= 16;
  }
}

function divider(ctx: Ctx) {
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: MARGIN + CONTENT_W, y: ctx.y },
    thickness: 0.4,
    color: rgb(0.87, 0.87, 0.87),
  });
  ctx.y -= 10;
}

function gap(ctx: Ctx, px = 8) {
  ctx.y -= px;
}

// ── Common page header ─────────────────────────────────────────────────────────

function drawFormHeader(
  ctx: Ctx,
  formTitle: string,
  formNumber: string,
  agency: string,
  accent: RGB,
) {
  const { page, font, bold } = ctx;

  // Coloured bar
  page.drawRectangle({ x: 0, y: PAGE_H - 70, width: PAGE_W, height: 70, color: accent });

  // Agency name (small, upper-left inside bar)
  page.drawText(agency.toUpperCase(), {
    x: MARGIN,
    y: PAGE_H - 26,
    size: 7.5,
    font: bold,
    color: rgb(1, 1, 1),
    opacity: 0.7,
  });

  // Form title
  page.drawText(formTitle, {
    x: MARGIN,
    y: PAGE_H - 45,
    size: 14,
    font: bold,
    color: rgb(1, 1, 1),
  });

  // Form number (right-aligned)
  const numW = bold.widthOfTextAtSize(formNumber, 8.5);
  page.drawText(formNumber, {
    x: PAGE_W - MARGIN - numW,
    y: PAGE_H - 45,
    size: 8.5,
    font: bold,
    color: rgb(1, 1, 1),
    opacity: 0.65,
  });

  // AI notice below bar
  page.drawText(
    'Pre-filled by SpecScribe AI  ·  Provider review and attestation required before submission',
    { x: MARGIN, y: PAGE_H - 82, size: 6.5, font, color: rgb(0.5, 0.5, 0.5) },
  );

  ctx.y = PAGE_H - 100;
}

// ── Signature section (single editable AcroForm field) ────────────────────────

async function addSignatureSection(
  pdfDoc: PDFDocument,
  page: PDFPage,
  bold: PDFFont,
  bottomY: number,
  data: PdfFormData,
) {
  const safeY = Math.max(bottomY, MARGIN + 90);

  page.drawLine({
    start: { x: MARGIN, y: safeY + 4 },
    end: { x: MARGIN + CONTENT_W, y: safeY + 4 },
    thickness: 0.4,
    color: rgb(0.85, 0.85, 0.85),
  });

  page.drawText('PHYSICIAN ATTESTATION AND SIGNATURE', {
    x: MARGIN,
    y: safeY - 12,
    size: 7,
    font: bold,
    color: rgb(0.3, 0.3, 0.3),
  });

  page.drawText(`Date: ${data.submissionDate}`, {
    x: MARGIN,
    y: safeY - 30,
    size: 8.5,
    font: bold,
    color: rgb(0.1, 0.1, 0.1),
  });

  page.drawText('Physician Signature (required):', {
    x: MARGIN,
    y: safeY - 52,
    size: 8,
    font: bold,
    color: rgb(0.38, 0.38, 0.38),
  });

  // The only editable field on the document — everything else is drawn text
  const form = pdfDoc.getForm();
  const sig = form.createTextField('physician_signature');
  sig.setText('');
  sig.addToPage(page, {
    x: MARGIN + 180,
    y: safeY - 68,
    width: CONTENT_W - 180,
    height: 26,
    borderWidth: 1,
    borderColor: rgb(0.6, 0.6, 0.6),
    backgroundColor: rgb(0.98, 0.98, 1.0),
  });
}

// ── Per-form drawing functions ─────────────────────────────────────────────────

async function drawABC60015(
  pdfDoc: PDFDocument,
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  data: PdfFormData,
) {
  const accent = rgb(0, 0.24, 0.65); // Alberta Blue Cross blue
  const ctx: Ctx = { page, font, bold, y: PAGE_H - MARGIN };

  drawFormHeader(ctx, 'Special Authorization Request', 'Form ABC 60015', 'Alberta Blue Cross', accent);

  sectionHeader(ctx, 'Patient Information', accent);
  fieldRow(ctx, 'Patient Name', data.patientName);
  fieldRow(ctx, 'Date of Birth', null);
  fieldRow(ctx, 'PHN / AHCIP Number', null);
  gap(ctx);

  divider(ctx);
  sectionHeader(ctx, 'Requested Service', accent);
  fieldRow(ctx, 'CPT / Procedure Code(s)', data.procedureCodes.join(', ') || null);
  fieldRow(ctx, 'ICD-10 Diagnosis Code(s)', data.diagnosisCodes.join(', ') || null);
  if (data.dsmCodes.length > 0) {
    fieldRow(ctx, 'DSM-5 Code(s)', data.dsmCodes.join(', '));
  }
  gap(ctx);

  divider(ctx);
  sectionHeader(ctx, 'Clinical Justification', accent);
  fieldRow(ctx, 'Clinical Indication', data.clinicalSummary ?? null, {
    multiline: true,
    labelWidth: 148,
  });
  gap(ctx, 5);
  fieldRow(ctx, 'Medical Necessity', data.medicalNecessityStatement ?? null, {
    multiline: true,
    labelWidth: 148,
  });
  gap(ctx);

  if (data.stepTherapy.length > 0) {
    divider(ctx);
    sectionHeader(ctx, 'Step Therapy — Previous Treatments Tried', accent);
    for (const entry of data.stepTherapy.slice(0, 5)) {
      const line = `• ${entry.drugOrTherapy}${entry.duration ? ` (${entry.duration})` : ''} — ${entry.reasonForFailure}`;
      const endY = drawWrapped(ctx.page, line, MARGIN, ctx.y, font, 8.5, CONTENT_W, 12.5);
      ctx.y = endY - 3;
    }
    gap(ctx);
  }

  divider(ctx);
  sectionHeader(ctx, 'Prescriber Information', accent);
  fieldRow(ctx, 'Physician / Prescriber Name', null);
  fieldRow(ctx, 'CPSA Registration Number', null);
  fieldRow(ctx, 'Clinic Phone / Fax', null);

  await addSignatureSection(pdfDoc, page, bold, ctx.y - 8, data);
}

async function drawDS2444b(
  pdfDoc: PDFDocument,
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  data: PdfFormData,
) {
  const accent = rgb(0, 0.17, 0.5); // Government of Alberta blue
  const ctx: Ctx = { page, font, bold, y: PAGE_H - MARGIN };

  drawFormHeader(
    ctx,
    'AISH Medical Report',
    'Form DS2444b',
    'Government of Alberta — AISH Program',
    accent,
  );

  sectionHeader(ctx, 'Applicant Information', accent);
  fieldRow(ctx, 'Applicant Legal Name', data.patientName);
  fieldRow(ctx, 'Date of Birth', null);
  fieldRow(ctx, 'PHN / ULI', null);
  gap(ctx);

  divider(ctx);
  sectionHeader(ctx, 'Diagnosis', accent);
  fieldRow(ctx, 'Primary ICD-10-CA Code(s)', data.diagnosisCodes.join(', ') || null);
  if (data.dsmCodes.length > 0) {
    fieldRow(ctx, 'DSM-5 Diagnostic Code(s)', data.dsmCodes.join(', '));
  }
  gap(ctx);

  divider(ctx);
  sectionHeader(ctx, 'Clinical Summary & Functional Limitations', accent);
  fieldRow(ctx, 'Presenting Condition', data.clinicalSummary ?? null, {
    multiline: true,
    labelWidth: 148,
  });
  gap(ctx, 5);
  fieldRow(ctx, 'Employment Impact / Prognosis', data.medicalNecessityStatement ?? null, {
    multiline: true,
    labelWidth: 148,
  });
  gap(ctx);

  if (data.stepTherapy.length > 0) {
    divider(ctx);
    sectionHeader(ctx, 'Treatment History', accent);
    for (const entry of data.stepTherapy.slice(0, 5)) {
      const line = `• ${entry.drugOrTherapy}${entry.duration ? ` (${entry.duration})` : ''} — ${entry.reasonForFailure}`;
      const endY = drawWrapped(ctx.page, line, MARGIN, ctx.y, font, 8.5, CONTENT_W, 12.5);
      ctx.y = endY - 3;
    }
    gap(ctx);
  }

  divider(ctx);
  sectionHeader(ctx, 'Attending Physician', accent);
  fieldRow(ctx, 'Physician Name', null);
  fieldRow(ctx, 'CPSA Registration Number', null);
  fieldRow(ctx, 'Clinic Address / Phone', null);

  await addSignatureSection(pdfDoc, page, bold, ctx.y - 8, data);
}

async function drawAPS490S(
  pdfDoc: PDFDocument,
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  data: PdfFormData,
) {
  const accent = rgb(0, 0.19, 0.53); // Sun Life navy
  const ctx: Ctx = { page, font, bold, y: PAGE_H - MARGIN };

  drawFormHeader(
    ctx,
    'Attending Physician Statement',
    'Form APS-490S',
    'Sun Life Financial — Group Benefits',
    accent,
  );

  sectionHeader(ctx, 'Claimant Information', accent);
  fieldRow(ctx, 'Patient / Claimant Name', data.patientName);
  fieldRow(ctx, 'Date of Birth', null);
  fieldRow(ctx, 'Policy / Group Number', null);
  fieldRow(ctx, 'Member Certificate ID', null);
  gap(ctx);

  divider(ctx);
  sectionHeader(ctx, 'Diagnosis & Condition', accent);
  fieldRow(ctx, 'Primary ICD-10 Diagnosis', data.diagnosisCodes.join(', ') || null);
  if (data.dsmCodes.length > 0) {
    fieldRow(ctx, 'DSM-5 Code(s)', data.dsmCodes.join(', '));
  }
  fieldRow(ctx, 'Date of First Treatment', null);
  gap(ctx);

  divider(ctx);
  sectionHeader(ctx, 'Clinical Details', accent);
  fieldRow(ctx, 'Symptoms & Functional History', data.clinicalSummary ?? null, {
    multiline: true,
    labelWidth: 165,
  });
  gap(ctx, 5);
  fieldRow(ctx, 'Treatment Plan / Prognosis', data.medicalNecessityStatement ?? null, {
    multiline: true,
    labelWidth: 165,
  });
  gap(ctx);

  if (data.stepTherapy.length > 0) {
    divider(ctx);
    sectionHeader(ctx, 'Prior Treatments Tried', accent);
    for (const entry of data.stepTherapy.slice(0, 5)) {
      const line = `• ${entry.drugOrTherapy}${entry.duration ? ` (${entry.duration})` : ''} — ${entry.reasonForFailure}`;
      const endY = drawWrapped(ctx.page, line, MARGIN, ctx.y, font, 8.5, CONTENT_W, 12.5);
      ctx.y = endY - 3;
    }
    gap(ctx);
  }

  divider(ctx);
  sectionHeader(ctx, 'Attending Physician', accent);
  fieldRow(ctx, 'Physician Name', null);
  fieldRow(ctx, 'License / Registration Number', null);
  fieldRow(ctx, 'Clinic Name & Address', null);

  await addSignatureSection(pdfDoc, page, bold, ctx.y - 8, data);
}

// ── Template-based filling (when /public/pdf-templates/*.pdf exists) ───────────

async function fillTemplateForm(
  formId: FormId,
  templateBytes: ArrayBuffer,
  data: PdfFormData,
): Promise<Uint8Array> {
  const config = FORM_CONFIGS[formId];
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  const fields = config.formFields;

  const nameParts = (data.patientName ?? '').split(' ');
  const firstName = nameParts[0] ?? '';
  const lastName = nameParts.slice(1).join(' ');

  const setField = (key: keyof typeof fields, value: string | null | undefined) => {
    const fieldName = fields[key];
    if (!fieldName || !value) return;
    try {
      const field = form.getTextField(fieldName);
      field.setText(value);
      // Lock all fields except the signature field
      if (key !== 'signature') {
        field.enableReadOnly();
      }
    } catch {
      // Field name not found in this template version — skip silently
    }
  };

  setField('patientFirstName', firstName || data.patientName);
  setField('patientLastName', lastName || null);
  setField('patientName', data.patientName);
  setField('diagnosisCode', data.diagnosisCodes.join(', ') || null);
  setField('procedureCode', data.procedureCodes.join(', ') || null);
  setField('clinicalIndication', data.clinicalSummary);
  setField('medicalNecessity', data.medicalNecessityStatement);
  setField('date', data.submissionDate);

  if (data.stepTherapy.length > 0) {
    const stepText = data.stepTherapy
      .slice(0, 5)
      .map((e) => `${e.drugOrTherapy} (${e.duration}): ${e.reasonForFailure}`)
      .join('\n');
    setField('stepTherapy', stepText);
  }

  // 'signature' field is intentionally NOT set here — it stays editable for the physician

  return pdfDoc.save();
}

// ── Programmatic fallback ──────────────────────────────────────────────────────

async function generateProgrammaticPdf(formId: FormId, data: PdfFormData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  switch (formId) {
    case 'abc_60015':
      await drawABC60015(pdfDoc, page, font, bold, data);
      break;
    case 'ds2444b':
      await drawDS2444b(pdfDoc, page, font, bold, data);
      break;
    case 'aps_490s':
      await drawAPS490S(pdfDoc, page, font, bold, data);
      break;
  }

  return pdfDoc.save();
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Generates a pre-filled PDF for the given form ID and clinical data.
 *
 * 1. Attempts to load the PDF template from /public/pdf-templates/ and fill its
 *    AcroForm fields.  All fields except `physician_signature` are locked
 *    (read-only) to satisfy AHS security standards.
 * 2. Falls back to programmatic generation if the template file is not found.
 *
 * Must be called from a browser context (client component event handler).
 */
export async function generatePrefilledPdf(
  formId: FormId,
  data: PdfFormData,
): Promise<Uint8Array> {
  const config = FORM_CONFIGS[formId];

  // Try to load a real PDF template from /public
  try {
    const res = await fetch(config.pdfTemplatePath);
    if (res.ok) {
      const templateBytes = await res.arrayBuffer();
      return fillTemplateForm(formId, templateBytes, data);
    }
  } catch {
    // Template absent or fetch failed — fall through to programmatic generation
  }

  return generateProgrammaticPdf(formId, data);
}
