import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── Marketing pages static coral palette ── */
        coral: {
          DEFAULT: "#e85d5d",
          light:   "#f07b7b",
          pale:    "#fce8e8",
          dark:    "#c94a4a",
        },

        /* ── shadcn/ui core tokens (CSS-var driven) ── */
        background: "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        card:    { DEFAULT: "hsl(var(--card))",    foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary:   { DEFAULT: "hsl(var(--secondary))",   foreground: "hsl(var(--secondary-foreground))" },
        muted:       { DEFAULT: "hsl(var(--muted))",       foreground: "hsl(var(--muted-foreground))" },
        accent:      { DEFAULT: "hsl(var(--accent))",      foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        border: "hsl(var(--border))",
        input:  "hsl(var(--input))",
        ring:   "hsl(var(--ring))",

        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },

        sidebar: {
          DEFAULT:              "hsl(var(--sidebar-background))",
          foreground:           "hsl(var(--sidebar-foreground))",
          primary:              "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent:               "hsl(var(--sidebar-accent))",
          "accent-foreground":  "hsl(var(--sidebar-accent-foreground))",
          border:               "hsl(var(--sidebar-border))",
          ring:                 "hsl(var(--sidebar-ring))",
        },

        /* ── SpecDoc neutral gray scale ── */
        gray: {
          50:  "hsl(var(--gray-50))",
          100: "hsl(var(--gray-100))",
          200: "hsl(var(--gray-200))",
          300: "hsl(var(--gray-300))",
          400: "hsl(var(--gray-400))",
          500: "hsl(var(--gray-500))",
          600: "hsl(var(--gray-600))",
          700: "hsl(var(--gray-700))",
          800: "hsl(var(--gray-800))",
          900: "hsl(var(--gray-900))",
        },

        /* ── SpecDoc semantic tokens ── */
        success: {
          DEFAULT:    "hsl(var(--specdoc-success))",
          foreground: "hsl(var(--specdoc-success-foreground))",
          surface:    "hsl(var(--specdoc-success-surface))",
        },
        warning: {
          DEFAULT:    "hsl(var(--specdoc-warning))",
          foreground: "hsl(var(--specdoc-warning-foreground))",
          surface:    "hsl(var(--specdoc-warning-surface))",
        },
        error: {
          DEFAULT:    "hsl(var(--specdoc-error))",
          foreground: "hsl(var(--specdoc-error-foreground))",
          surface:    "hsl(var(--specdoc-error-surface))",
        },
        info: {
          DEFAULT:    "hsl(var(--specdoc-info))",
          foreground: "hsl(var(--specdoc-info-foreground))",
          surface:    "hsl(var(--specdoc-info-surface))",
        },

        /* ── SpecDoc AI confidence tokens ── */
        "ai-high": {
          DEFAULT:    "hsl(var(--specdoc-ai-high))",
          surface:    "hsl(var(--specdoc-ai-high-surface))",
          foreground: "hsl(var(--specdoc-ai-high-foreground))",
        },
        "ai-medium": {
          DEFAULT:    "hsl(var(--specdoc-ai-medium))",
          surface:    "hsl(var(--specdoc-ai-medium-surface))",
          foreground: "hsl(var(--specdoc-ai-medium-foreground))",
        },
        "ai-low": {
          DEFAULT:    "hsl(var(--specdoc-ai-low))",
          surface:    "hsl(var(--specdoc-ai-low-surface))",
          foreground: "hsl(var(--specdoc-ai-low-foreground))",
        },
        "ai-surface":    "hsl(var(--specdoc-ai-surface))",
        "ai-border":     "hsl(var(--specdoc-ai-border))",
        "ai-processing": {
          DEFAULT: "hsl(var(--specdoc-ai-processing))",
          surface: "hsl(var(--specdoc-ai-processing-surface))",
        },

        /* ── SpecDoc encounter status tokens ── */
        encounter: {
          "not-started":      "hsl(var(--specdoc-encounter-not-started))",
          "not-started-bg":   "hsl(var(--specdoc-encounter-not-started-bg))",
          "in-progress":      "hsl(var(--specdoc-encounter-in-progress))",
          "in-progress-bg":   "hsl(var(--specdoc-encounter-in-progress-bg))",
          "ai-processing":    "hsl(var(--specdoc-encounter-ai-processing))",
          "ai-processing-bg": "hsl(var(--specdoc-encounter-ai-processing-bg))",
          "needs-review":     "hsl(var(--specdoc-encounter-needs-review))",
          "needs-review-bg":  "hsl(var(--specdoc-encounter-needs-review-bg))",
          finalized:          "hsl(var(--specdoc-encounter-finalized))",
          "finalized-bg":     "hsl(var(--specdoc-encounter-finalized-bg))",
        },

        /* ── SpecDoc compliance status tokens ── */
        compliance: {
          compliant:          "hsl(var(--specdoc-compliance-compliant))",
          "compliant-bg":     "hsl(var(--specdoc-compliance-compliant-bg))",
          "at-risk":          "hsl(var(--specdoc-compliance-at-risk))",
          "at-risk-bg":       "hsl(var(--specdoc-compliance-at-risk-bg))",
          "non-compliant":    "hsl(var(--specdoc-compliance-non-compliant))",
          "non-compliant-bg": "hsl(var(--specdoc-compliance-non-compliant-bg))",
        },

        /* ── SpecDoc prior auth status tokens ── */
        auth: {
          pending:       "hsl(var(--specdoc-auth-pending))",
          "pending-bg":  "hsl(var(--specdoc-auth-pending-bg))",
          submitted:     "hsl(var(--specdoc-auth-submitted))",
          "submitted-bg":"hsl(var(--specdoc-auth-submitted-bg))",
          approved:      "hsl(var(--specdoc-auth-approved))",
          "approved-bg": "hsl(var(--specdoc-auth-approved-bg))",
          denied:        "hsl(var(--specdoc-auth-denied))",
          "denied-bg":   "hsl(var(--specdoc-auth-denied-bg))",
          appeal:        "hsl(var(--specdoc-auth-appeal))",
          "appeal-bg":   "hsl(var(--specdoc-auth-appeal-bg))",
        },

        /* ── SpecDoc specialty accent tokens ── */
        specialty: {
          "behavioral-health":    "hsl(var(--specdoc-specialty-behavioral-health))",
          "behavioral-health-bg": "hsl(var(--specdoc-specialty-behavioral-health-bg))",
          dermatology:            "hsl(var(--specdoc-specialty-dermatology))",
          "dermatology-bg":       "hsl(var(--specdoc-specialty-dermatology-bg))",
          orthopedics:            "hsl(var(--specdoc-specialty-orthopedics))",
          "orthopedics-bg":       "hsl(var(--specdoc-specialty-orthopedics-bg))",
          "pain-management":      "hsl(var(--specdoc-specialty-pain-management))",
          "pain-management-bg":   "hsl(var(--specdoc-specialty-pain-management-bg))",
          oncology:               "hsl(var(--specdoc-specialty-oncology))",
          "oncology-bg":          "hsl(var(--specdoc-specialty-oncology-bg))",
        },
      },

      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },

      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
