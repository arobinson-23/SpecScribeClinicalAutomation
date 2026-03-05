# CLAUDE.md — SpecScribe

AI-native clinical documentation & compliance platform for specialty medical practices.

## Quick Reference

- **Model**: `claude-sonnet-4-6` for all Claude API calls
- **Stack**: Next.js 15 App Router, TypeScript strict, Prisma 5, PostgreSQL 16+pgvector
- **Auth**: NextAuth.js with TOTP MFA (mandatory), RBAC, 15-min session idle timeout
- **PHI Encryption**: AES-256-GCM at application layer before DB write
- **AI**: Anthropic Claude for note generation/coding/prior-auth; Deepgram nova-2-medical for STT

## Non-Negotiable Rules

1. **Every DB query scoped by `practiceId`** — extracted from JWT session, never from request params
2. **Never log PHI** — log field names only, never values
3. **Never auto-finalize** — AI generates drafts; providers must review and approve everything
4. **Encrypt PHI before DB write** — use `encryptPHI()` from `src/lib/db/encryption.ts`
5. **Audit every PHI access** — call `writeAuditLog()` after each read/write of PHI

## Detailed Rules (auto-loaded from `.claude/rules/`)

@.claude/rules/01-project-overview.md
@.claude/rules/02-technical-architecture.md
@.claude/rules/03-data-model.md
@.claude/rules/04-core-features.md
@.claude/rules/05-ai-system-design.md
@.claude/rules/06-coding-standards.md
@.claude/rules/07-security-pipeda.md
@.claude/rules/08-environment-variables.md
@.claude/rules/09-development-workflow.md
@.claude/rules/10-testing-strategy.md
@.claude/rules/11-deployment-checklist.md
@.claude/rules/12-metrics.md
@.claude/rules/13-constraints.md

## Homepage Section Adding
Accept a reference from a webapp page, generate a section for the homepage that mirrors the visual style with changes to content to mirror the SpecScribe brand, screenshot the output, and iterate until achieving ~99% visual fidelity.

## Inputs

1. **Reference website page** (required) — PNG/JPG of the target UI. Place at `reference.png`.
2. **CSS / design tokens** (optional) — existing stylesheets, color palettes, font specs, or component libraries.
3. **Target URL or page type** (optional) — e.g., "landing page", "dashboard", "pricing table".

## Workflow

Follow these steps in order:

1. Analyze the reference → output design spec summary
2. Generate code for the section or page for the .next web app
3. Screenshot the output
4. Compare against reference and score fidelity
5. Iterate (steps 2–4) until score ≥ 99% or 8 iterations reached
6. Deliver final output files

## Next.js App Feature Integration
Accept a feature description or reference UI, build and wire it fully into the Next.js 15 App Router codebase following all project conventions, then verify the build and functionality before delivering.

### Inputs

1. **Feature description** (required) — plain-language spec, Figma screenshot, or reference UI image. Place any image at `reference.png`.
2. **Target route or page** (required) — e.g., `app/(dashboard)/encounters/[id]/page.tsx` or "new page under admin".
3. **Scope** (required) — choose one: `UI only` | `API route + UI` | `full stack (DB + API + UI)`.
4. **Existing context** (optional) — related files, Prisma models, or API routes to extend rather than create.

### Workflow

Follow these steps in order:

1. **Audit existing code** — read all files in the target route, related Prisma schema models, and any shared components the feature will consume. Do not generate code blind.
2. **Plan the integration** — list every file that will be created or modified; flag any schema migration, new env var, or new dependency required. Confirm with user if scope is ambiguous.
3. **Schema / migration first** (full-stack scope only) — update `prisma/schema.prisma`, run `npx prisma migrate dev --name <feature-name>`, and regenerate the Prisma client before writing application code.
4. **API route(s)** (API or full-stack scope) — create route handlers under `app/api/`. Validate every request body with Zod. Scope every DB query by `practiceId` from the session JWT. Call `writeAuditLog()` after every PHI read/write. Return `{ data, error, meta }` envelope.
5. **Server Component(s)** — build RSC page and layout files. Fetch data server-side; pass serialisable props to Client Components only. Use `decryptPHISafe()` for any PHI fields rendered in the UI.
6. **Client Component(s)** — add `'use client'` only where interactivity or hooks are required. Keep components under 200 lines; extract sub-components aggressively.
7. **Wire navigation + RBAC** — add any new route to the sidebar nav and protect it with the correct `allowedRoles` check from `src/lib/auth/rbac.ts`. Redirect unauthorized users to `/403`.
8. **Run dev server and screenshot** — start `npm run dev`, navigate to the new route, and screenshot the output.
9. **Compare against reference and score fidelity** (if a visual reference was provided) — iterate steps 5–8 until score ≥ 99% or 8 iterations reached.
10. **Type-check and test** — run `npx tsc --noEmit` and `npm test`. Fix all errors before marking complete.
11. **Deliver a change summary** — list every file created/modified, any migration name, env vars added, and RBAC roles affected.

### Guardrails (always enforced)

- No `any` types — use `unknown` with type guards.
- No PHI in logs — field names only, never values.
- No auto-finalizing — AI output stays as draft until provider approves.
- No `encryptPHI()` calls skipped on fields listed in the PHI field table (`07-security-pipeda.md`).
- No DB queries without `practiceId` scope.
- No new pages shipped without an RBAC gate.

