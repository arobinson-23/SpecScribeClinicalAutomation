import Papa from "papaparse";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RawDemographicsRow {
  PHN: string;
  PatientPseudoID: string;
  FirstName: string;
  LastName: string;
  DOB: string;           // various formats: YYYY-MM-DD, MM/DD/YYYY, DD-MON-YYYY
  Sex: string;           // M, F, Male, Female, Other, Unknown
  Phone?: string;
  Email?: string;
  Address?: string;
  City?: string;
  Province?: string;
  PostalCode?: string;
}

export interface ParsedPatient {
  phn: string;
  pseudoId: string;
  firstName: string;
  lastName: string;
  dob: string;           // normalised YYYY-MM-DD
  sex: "male" | "female" | "other" | "unknown";
  phone: string | null;
  email: string | null;
  address: {
    street: string;
    city: string;
    province: string;
    postal: string;
  } | null;
}

export interface ParseResult {
  rows: ParsedPatient[];
  errors: Array<{ row: number; message: string }>;
}

// ── Normalisation helpers ─────────────────────────────────────────────────────

function normaliseDob(raw: string): string {
  const trimmed = raw.trim();

  // YYYY-MM-DD already correct
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // MM/DD/YYYY
  const mdy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]!}-${mdy[1]!.padStart(2, "0")}-${mdy[2]!.padStart(2, "0")}`;

  // DD-MON-YYYY (e.g. 15-JAN-1980)
  const monthMap: Record<string, string> = {
    JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
    JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
  };
  const dmy = trimmed.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (dmy) {
    const month = monthMap[dmy[2]!.toUpperCase()];
    if (month) return `${dmy[3]!}-${month}-${dmy[1]!.padStart(2, "0")}`;
  }

  // DD/MM/YYYY (Alberta common format)
  const dmy2 = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy2) return `${dmy2[3]!}-${dmy2[2]!.padStart(2, "0")}-${dmy2[1]!.padStart(2, "0")}`;

  return trimmed; // return as-is, validation will catch it
}

function normaliseSex(raw: string): ParsedPatient["sex"] {
  switch (raw.trim().toLowerCase()) {
    case "m":
    case "male":
      return "male";
    case "f":
    case "female":
      return "female";
    case "o":
    case "other":
      return "other";
    default:
      return "unknown";
  }
}

function normalisePhone(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  // Strip all non-digit characters
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits;
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseDemographicsCsv(csvText: string): ParseResult {
  const { data, errors: parseErrors } = Papa.parse<RawDemographicsRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const rows: ParsedPatient[] = [];
  const errors: ParseResult["errors"] = [];

  if (parseErrors.length > 0) {
    parseErrors.forEach((e) => {
      errors.push({ row: e.row ?? 0, message: `CSV parse error: ${e.message}` });
    });
  }

  data.forEach((raw, index) => {
    const rowNum = index + 2; // 1-based + header row

    const phn = raw.PHN?.trim();
    if (!phn) {
      errors.push({ row: rowNum, message: "Missing PHN — row skipped" });
      return;
    }

    const firstName = raw.FirstName?.trim();
    const lastName = raw.LastName?.trim();
    if (!firstName || !lastName) {
      errors.push({ row: rowNum, message: `PHN ${phn}: missing first or last name` });
      return;
    }

    const dob = normaliseDob(raw.DOB ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      errors.push({ row: rowNum, message: `PHN ${phn}: unrecognised DOB format '${raw.DOB}'` });
      return;
    }

    const address =
      raw.Address?.trim() || raw.City?.trim()
        ? {
            street: raw.Address?.trim() ?? "",
            city: raw.City?.trim() ?? "",
            province: raw.Province?.trim() ?? "AB",
            postal: raw.PostalCode?.trim() ?? "",
          }
        : null;

    rows.push({
      phn,
      pseudoId: raw.PatientPseudoID?.trim() ?? "",
      firstName,
      lastName,
      dob,
      sex: normaliseSex(raw.Sex ?? ""),
      phone: normalisePhone(raw.Phone),
      email: raw.Email?.trim().toLowerCase() || null,
      address,
    });
  });

  return { rows, errors };
}
