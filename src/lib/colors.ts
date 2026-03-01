/**
 * SpecScribe — Typed Color Token Constants
 *
 * Use these in non-Tailwind contexts:
 *   - Recharts (stroke, fill props)
 *   - Dynamic inline styles
 *   - Canvas rendering
 *
 * Values are resolved HSL strings matching the CSS variables in globals.css.
 * For components that can use Tailwind classes, prefer Tailwind over these.
 */

// ── Helpers ─────────────────────────────────────────────────

function hsl(h: number, s: number, l: number): string {
  return `hsl(${h} ${s}% ${l}%)`;
}

// ── Core Brand ──────────────────────────────────────────────

export const colors = {
  /** Midnight Navy #0F172A — sidebars, headers, primary branding */
  primary:   hsl(222, 47, 11),
  /** Warm sage-gray — secondary actions */
  secondary: hsl(165, 16, 93),

  // ── Semantic ──────────────────────────────────────────────

  /** Emerald #10B981 — Note Finalized, Sync Complete, approved */
  success: hsl(160, 84, 39),
  /** Warm amber — pending items, approaching deadlines, medium-confidence AI */
  warning: hsl(38, 88, 46),
  /** Soft clinical red — denied claims, violations, failures */
  error:   hsl(355, 68, 48),
  /** Lighter teal — AI suggestions, tooltips, system messages */
  info:    hsl(199, 65, 42),

  // ── AI Confidence ─────────────────────────────────────────

  ai: {
    high:   hsl(160, 84, 39),
    medium: hsl(38, 88, 46),
    low:    hsl(355, 68, 48),
    /** Subtle cyan background tint for AI-generated content blocks */
    surface:    hsl(189, 40, 96),
    border:     hsl(189, 45, 84),
    /** Electric Cyan #06B6D4 — AI processing states, Record buttons */
    processing: hsl(189, 94, 43),
  },

  // ── Encounter Statuses ────────────────────────────────────

  encounter: {
    notStarted:    hsl(220, 8, 62),
    inProgress:    hsl(189, 94, 43),
    aiProcessing:  hsl(189, 94, 43),
    needsReview:   hsl(38, 88, 46),
    finalized:     hsl(160, 84, 39),
  },

  // ── Compliance Statuses ───────────────────────────────────

  compliance: {
    compliant:    hsl(160, 84, 39),
    atRisk:       hsl(38, 88, 46),
    nonCompliant: hsl(355, 68, 48),
  },

  // ── Prior Auth Statuses ───────────────────────────────────

  priorAuth: {
    pending:   hsl(220, 8, 62),
    submitted: hsl(189, 94, 43),
    approved:  hsl(160, 84, 39),
    denied:    hsl(355, 68, 48),
    appeal:    hsl(265, 65, 58),
  },

  // ── Specialty Accents ─────────────────────────────────────

  specialty: {
    behavioralHealth: hsl(265, 50, 56),
    dermatology:      hsl(350, 68, 56),
    orthopedics:      hsl(199, 65, 38),
    painManagement:   hsl(28, 80, 50),
    oncology:         hsl(152, 42, 36),
  },

  // ── Neutral Gray Scale (warm undertone) ───────────────────

  gray: {
    50:  hsl(220, 18, 98),
    100: hsl(220, 14, 95),
    200: hsl(220, 12, 90),
    300: hsl(220, 10, 82),
    400: hsl(220, 8,  65),
    500: hsl(220, 7,  50),
    600: hsl(220, 8,  38),
    700: hsl(220, 10, 28),
    800: hsl(220, 12, 18),
    900: hsl(220, 16, 10),
  },

  // ── Chart Series (Recharts-ready) ─────────────────────────

  chart: [
    hsl(222, 47, 40),  // midnight navy variant
    hsl(160, 75, 42),  // emerald variant
    hsl(38,  88, 50),  // amber
    hsl(189, 80, 42),  // electric cyan variant
    hsl(355, 68, 52),  // soft clinical red
  ],

  // ── Background Hierarchy ──────────────────────────────────

  background: {
    page:     hsl(210, 40, 98),   // Soft Slate #F8FAFC — reduces glare
    card:     hsl(210, 20, 99),   // slightly lighter card surface
    elevated: hsl(0, 0, 100),     // pure white for modals
    sidebar:  hsl(222, 47, 11),   // Midnight Navy #0F172A (consistent across modes)
    muted:    hsl(210, 14, 93),   // disabled / muted surfaces
  },
} as const;

// ── Typed helpers for status-driven colour lookup ─────────

export type EncounterStatus = keyof typeof colors.encounter;
export type ComplianceStatus = keyof typeof colors.compliance;
export type PriorAuthStatus = keyof typeof colors.priorAuth;
export type SpecialtyKey = keyof typeof colors.specialty;
export type AiConfidence = "high" | "medium" | "low";

export function encounterStatusColor(status: EncounterStatus): string {
  return colors.encounter[status];
}

export function complianceStatusColor(status: ComplianceStatus): string {
  return colors.compliance[status];
}

export function priorAuthStatusColor(status: PriorAuthStatus): string {
  return colors.priorAuth[status];
}

export function aiConfidenceColor(level: AiConfidence): string {
  return colors.ai[level];
}
