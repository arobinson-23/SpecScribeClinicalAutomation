/**
 * SpecScribe Palette Preview — internal dev reference only
 * Route: /dev/palette (add to app/dev/palette/page.tsx if needed)
 */

type SwatchRow = {
  token: string;
  cssVar: string;
  tailwind: string;
  usage: string;
};

type Section = {
  heading: string;
  rows: SwatchRow[];
};

const sections: Section[] = [
  {
    heading: "Core Brand",
    rows: [
      { token: "Primary",            cssVar: "--primary",            tailwind: "bg-primary",            usage: "Buttons, links, active states, focus rings" },
      { token: "Primary Foreground", cssVar: "--primary-foreground", tailwind: "text-primary-foreground",usage: "Text on primary-coloured backgrounds" },
      { token: "Secondary",          cssVar: "--secondary",          tailwind: "bg-secondary",           usage: "Secondary button bg, subtle chips" },
      { token: "Secondary Foreground",cssVar:"--secondary-foreground",tailwind:"text-secondary-foreground",usage:"Text on secondary surfaces" },
      { token: "Accent",             cssVar: "--accent",             tailwind: "bg-accent",              usage: "Hover backgrounds, focus tints" },
    ],
  },
  {
    heading: "Surfaces & Layout",
    rows: [
      { token: "Background",  cssVar: "--background",  tailwind: "bg-background",  usage: "Page background — warm off-white" },
      { token: "Card",        cssVar: "--card",        tailwind: "bg-card",        usage: "Card/panel surfaces" },
      { token: "Popover",     cssVar: "--popover",     tailwind: "bg-popover",     usage: "Dropdowns, tooltips, modals" },
      { token: "Muted",       cssVar: "--muted",       tailwind: "bg-muted",       usage: "Disabled states, code blocks, muted areas" },
      { token: "Border",      cssVar: "--border",      tailwind: "border-border",  usage: "Default dividers and outlines" },
      { token: "Input",       cssVar: "--input",       tailwind: "border-input",   usage: "Form field borders" },
    ],
  },
  {
    heading: "Semantic",
    rows: [
      { token: "Success",     cssVar: "--specdoc-success",  tailwind: "bg-success",   usage: "Completed notes, approved claims, passed checks" },
      { token: "Success Surface",cssVar:"--specdoc-success-surface",tailwind:"bg-success-surface",usage:"Row/cell tint for success state" },
      { token: "Warning",     cssVar: "--specdoc-warning",  tailwind: "bg-warning",   usage: "Pending items, medium-confidence AI, deadlines" },
      { token: "Warning Surface",cssVar:"--specdoc-warning-surface",tailwind:"bg-warning-surface",usage:"Row/cell tint for warning state" },
      { token: "Error",       cssVar: "--specdoc-error",    tailwind: "bg-error",     usage: "Denied claims, violations, failed validations" },
      { token: "Error Surface", cssVar:"--specdoc-error-surface",tailwind:"bg-error-surface",usage:"Row/cell tint for error state" },
      { token: "Destructive", cssVar: "--destructive",      tailwind: "bg-destructive",usage:"shadcn destructive actions (delete, irreversible)" },
      { token: "Info",        cssVar: "--specdoc-info",     tailwind: "bg-info",      usage: "AI suggestions, tooltips, system messages" },
      { token: "Info Surface",cssVar: "--specdoc-info-surface", tailwind:"bg-info-surface",usage:"Tinted background for informational panels" },
    ],
  },
  {
    heading: "AI Confidence",
    rows: [
      { token: "AI High",            cssVar: "--specdoc-ai-high",             tailwind: "bg-ai-high",             usage: "HIGH confidence code suggestion badge" },
      { token: "AI High Surface",    cssVar: "--specdoc-ai-high-surface",     tailwind: "bg-ai-high-surface",     usage: "Background tint for high-confidence rows" },
      { token: "AI Medium",          cssVar: "--specdoc-ai-medium",           tailwind: "bg-ai-medium",           usage: "MEDIUM confidence suggestion badge" },
      { token: "AI Medium Surface",  cssVar: "--specdoc-ai-medium-surface",   tailwind: "bg-ai-medium-surface",   usage: "Background tint for medium-confidence rows" },
      { token: "AI Low",             cssVar: "--specdoc-ai-low",              tailwind: "bg-ai-low",              usage: "LOW confidence — review required" },
      { token: "AI Low Surface",     cssVar: "--specdoc-ai-low-surface",      tailwind: "bg-ai-low-surface",      usage: "Background tint for low-confidence rows" },
      { token: "AI Generated Surface",cssVar:"--specdoc-ai-surface",          tailwind: "bg-ai-surface",          usage: "Subtle tint distinguishing AI content from human text" },
      { token: "AI Generated Border",cssVar: "--specdoc-ai-border",           tailwind: "border-ai-border",       usage: "Border for AI content blocks" },
      { token: "AI Processing",      cssVar: "--specdoc-ai-processing",       tailwind: "bg-ai-processing",       usage: "Loading/thinking state — distinct from all semantic colors" },
      { token: "AI Processing Surface",cssVar:"--specdoc-ai-processing-surface",tailwind:"bg-ai-processing/surface",usage:"Pulsing bg during AI generation" },
    ],
  },
  {
    heading: "Encounter Statuses",
    rows: [
      { token: "Not Started",    cssVar: "--specdoc-encounter-not-started",      tailwind: "text-encounter-not-started",    usage: "No action taken yet" },
      { token: "In Progress",    cssVar: "--specdoc-encounter-in-progress",      tailwind: "text-encounter-in-progress",    usage: "Recording or transcription active" },
      { token: "AI Processing",  cssVar: "--specdoc-encounter-ai-processing",    tailwind: "text-encounter-ai-processing",  usage: "AI generating note / suggestions" },
      { token: "Needs Review",   cssVar: "--specdoc-encounter-needs-review",     tailwind: "text-encounter-needs-review",   usage: "Draft ready, provider must approve" },
      { token: "Finalized",      cssVar: "--specdoc-encounter-finalized",        tailwind: "text-encounter-finalized",      usage: "Provider signed off — complete" },
    ],
  },
  {
    heading: "Compliance Statuses",
    rows: [
      { token: "Compliant",     cssVar: "--specdoc-compliance-compliant",     tailwind: "text-compliance-compliant",     usage: "All checks passed" },
      { token: "At Risk",       cssVar: "--specdoc-compliance-at-risk",       tailwind: "text-compliance-at-risk",       usage: "Warnings present, action recommended" },
      { token: "Non-Compliant", cssVar: "--specdoc-compliance-non-compliant", tailwind: "text-compliance-non-compliant", usage: "Critical violations — immediate action" },
    ],
  },
  {
    heading: "Prior Auth Statuses",
    rows: [
      { token: "Pending",   cssVar: "--specdoc-auth-pending",   tailwind: "text-auth-pending",   usage: "Not yet submitted" },
      { token: "Submitted", cssVar: "--specdoc-auth-submitted", tailwind: "text-auth-submitted", usage: "Sent to payer, awaiting decision" },
      { token: "Approved",  cssVar: "--specdoc-auth-approved",  tailwind: "text-auth-approved",  usage: "Authorization granted" },
      { token: "Denied",    cssVar: "--specdoc-auth-denied",    tailwind: "text-auth-denied",    usage: "Payer declined — appeal available" },
      { token: "Appeal",    cssVar: "--specdoc-auth-appeal",    tailwind: "text-auth-appeal",    usage: "Appeal filed or in progress" },
    ],
  },
  {
    heading: "Specialty Accents",
    rows: [
      { token: "Behavioral Health", cssVar: "--specdoc-specialty-behavioral-health", tailwind: "bg-specialty-behavioral-health", usage: "Tagging chips, category labels for psychiatry / therapy" },
      { token: "Dermatology",       cssVar: "--specdoc-specialty-dermatology",       tailwind: "bg-specialty-dermatology",       usage: "Dermatology-specific encounter or template tags" },
      { token: "Orthopedics",       cssVar: "--specdoc-specialty-orthopedics",       tailwind: "bg-specialty-orthopedics",       usage: "Orthopedic procedure and note type tags" },
      { token: "Pain Management",   cssVar: "--specdoc-specialty-pain-management",   tailwind: "bg-specialty-pain-management",   usage: "Pain / opioid treatment tags" },
      { token: "Oncology",          cssVar: "--specdoc-specialty-oncology",          tailwind: "bg-specialty-oncology",          usage: "Cancer care encounter tags" },
    ],
  },
  {
    heading: "Neutral Gray Scale",
    rows: [
      { token: "Gray 50",  cssVar: "--gray-50",  tailwind: "bg-gray-50",  usage: "Subtle row zebra-striping, hover bg" },
      { token: "Gray 100", cssVar: "--gray-100", tailwind: "bg-gray-100", usage: "Table headers, secondary surfaces" },
      { token: "Gray 200", cssVar: "--gray-200", tailwind: "bg-gray-200", usage: "Dividers, skeleton loaders" },
      { token: "Gray 300", cssVar: "--gray-300", tailwind: "bg-gray-300", usage: "Placeholder text bg, disabled chips" },
      { token: "Gray 400", cssVar: "--gray-400", tailwind: "bg-gray-400", usage: "Placeholder icons, muted text" },
      { token: "Gray 500", cssVar: "--gray-500", tailwind: "bg-gray-500", usage: "Supporting body text, labels" },
      { token: "Gray 600", cssVar: "--gray-600", tailwind: "bg-gray-600", usage: "Secondary headings, strong labels" },
      { token: "Gray 700", cssVar: "--gray-700", tailwind: "bg-gray-700", usage: "Primary body text" },
      { token: "Gray 800", cssVar: "--gray-800", tailwind: "bg-gray-800", usage: "Headings on light bg" },
      { token: "Gray 900", cssVar: "--gray-900", tailwind: "bg-gray-900", usage: "Dark section backgrounds, sidebar text" },
    ],
  },
];

function SwatchCell({ cssVar }: { cssVar: string }) {
  return (
    <td className="px-3 py-2 w-14">
      <div
        className="w-10 h-10 rounded-md border border-black/10 shadow-inner"
        style={{ background: `hsl(var(${cssVar}))` }}
        title={`hsl(var(${cssVar}))`}
      />
    </td>
  );
}

function TokenTable({ rows }: { rows: SwatchRow[] }) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b border-gray-200 text-left">
          <th className="px-3 py-2 font-semibold text-gray-500 w-14">Swatch</th>
          <th className="px-3 py-2 font-semibold text-gray-700">Token</th>
          <th className="px-3 py-2 font-semibold text-gray-500 font-mono text-xs">CSS Variable</th>
          <th className="px-3 py-2 font-semibold text-gray-500 font-mono text-xs">Tailwind Class</th>
          <th className="px-3 py-2 font-semibold text-gray-500">Usage</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.cssVar} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
            <SwatchCell cssVar={row.cssVar} />
            <td className="px-3 py-2 font-medium text-gray-800">{row.token}</td>
            <td className="px-3 py-2 font-mono text-xs text-gray-500">{row.cssVar}</td>
            <td className="px-3 py-2 font-mono text-xs text-primary">{row.tailwind}</td>
            <td className="px-3 py-2 text-xs text-gray-500">{row.usage}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PalettePreview() {
  return (
    <div className="min-h-screen bg-background text-foreground p-10 font-sans">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">S</div>
            <h1 className="text-2xl font-bold text-foreground">SpecScribe Design Token Palette</h1>
            <span className="ml-2 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded font-mono">internal / dev only</span>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            All tokens are defined as CSS custom properties in{" "}
            <code className="font-mono bg-muted px-1 rounded">globals.css</code> and mapped to Tailwind utilities in{" "}
            <code className="font-mono bg-muted px-1 rounded">tailwind.config.ts</code>.
            For non-Tailwind contexts (Recharts, inline styles), import from{" "}
            <code className="font-mono bg-muted px-1 rounded">@/lib/colors</code>.
          </p>
        </div>

        {/* Light / Dark mode toggle note */}
        <div className="mb-8 p-4 bg-info-surface border border-info/20 rounded-lg text-sm text-info-foreground flex gap-2 items-start">
          <span className="mt-0.5">ℹ</span>
          <span>
            All tokens have <strong>dark mode variants</strong> under the{" "}
            <code className="font-mono bg-black/10 px-1 rounded">.dark</code> selector.
            Toggle dark mode via{" "}
            <code className="font-mono bg-black/10 px-1 rounded">document.documentElement.classList.toggle(&apos;dark&apos;)</code>{" "}
            to preview dark variants.
          </span>
        </div>

        {/* Sections */}
        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-base font-bold text-foreground mb-3 pb-2 border-b border-border">
                {section.heading}
              </h2>
              <div className="rounded-lg border border-border overflow-hidden bg-card">
                <TokenTable rows={section.rows} />
              </div>
            </section>
          ))}
        </div>

        {/* Chart colour row */}
        <section className="mt-10">
          <h2 className="text-base font-bold text-foreground mb-3 pb-2 border-b border-border">
            Chart Series
          </h2>
          <div className="flex gap-4 p-4 bg-card border border-border rounded-lg">
            {[
              { label: "Series 1 — Primary Teal",  cssVar: "--chart-1" },
              { label: "Series 2 — Clinical Green", cssVar: "--chart-2" },
              { label: "Series 3 — Amber",          cssVar: "--chart-3" },
              { label: "Series 4 — AI Purple",      cssVar: "--chart-4" },
              { label: "Series 5 — Soft Red",       cssVar: "--chart-5" },
            ].map(({ label, cssVar }) => (
              <div key={cssVar} className="flex flex-col items-center gap-2">
                <div
                  className="w-12 h-12 rounded-lg border border-black/10 shadow-sm"
                  style={{ background: `hsl(var(${cssVar}))` }}
                />
                <span className="text-xs text-center text-muted-foreground max-w-[80px] leading-tight">{label}</span>
                <code className="text-[10px] text-muted-foreground font-mono">{cssVar}</code>
              </div>
            ))}
          </div>
        </section>

        <p className="mt-12 text-xs text-muted-foreground text-center">
          All text/background pairings meet WCAG AA (≥ 4.5:1 body, ≥ 3:1 large) — see contrast notes in globals.css.
        </p>
      </div>
    </div>
  );
}
