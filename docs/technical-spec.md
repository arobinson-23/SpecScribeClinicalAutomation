# SpecScribe — Technical Specification

**Version:** 0.1.0
**Last Updated:** 2026-02-26
**Status:** Active Development (Phase 1 MVP)

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [System Architecture](#2-system-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Authentication & Authorization](#4-authentication--authorization)
5. [Data Model](#5-data-model)
6. [PHI Encryption](#6-phi-encryption)
7. [AI System](#7-ai-system)
8. [API Design](#8-api-design)
9. [Real-Time Audio & Transcription](#9-real-time-audio--transcription)
10. [Privacy & Compliance Controls](#10-privacy--compliance-controls)
11. [Environment Configuration](#11-environment-configuration)
12. [Development Workflow](#12-development-workflow)
13. [Implementation Status](#13-implementation-status)
14. [Known Gaps & TODOs](#14-known-gaps--todos)

---

## 1. Product Overview

SpecScribe is a B2B SaaS platform providing AI-powered clinical documentation, coding optimization, and compliance automation for specialty medical practices (3–30 providers). It operates as an EHR-agnostic intelligence layer — working alongside existing EHR systems via FHIR R4, not replacing them.

### Target Market
- **Primary buyer:** Practice Administrator or Medical Director at a 3–30 provider specialty practice ($2M–$30M ARR)
- **Starting vertical:** Behavioral health
- **Expansion:** Dermatology → Orthopedics → Pain Management → Oncology

### Value Proposition
| Problem | SpecScribe Solution |
|---|---|
| 2+ hrs/day on documentation | AI note generation from ambient audio in <15s |
| 15–25% claim denial rates | AI coding suggestions with payer rule validation |
| 35+ staff hrs/week on prior auth | Automated PA form population + appeal letters |
| $40–80K/yr/provider for scribes | Ambient AI scribe at ~$1,200/provider/month |

---

## 2. System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                         │
│  Next.js 15 App Router │ React 18 │ TailwindCSS          │
│  ├── Marketing pages  (/, /pricing, /demo, /industry-use)│
│  ├── Auth pages        (/sign-in, /sign-up via Clerk)    │
│  ├── Provider Dashboard (/dashboard, /encounters/*)      │
│  └── Admin Dashboard   (/settings/*, /analytics)        │
└─────────────────────────────┬────────────────────────────┘
                              │ HTTPS / WebSocket
┌─────────────────────────────▼────────────────────────────┐
│                   NEXT.JS API LAYER                      │
│  App Router Route Handlers (app/api/**)                  │
│  ├── Clerk middleware (auth gate on all /dashboard routes)│
│  ├── Zod request validation on all POST/PATCH/PUT        │
│  ├── practiceId scoping on every DB query                │
│  └── Audit log on every PHI read/write                   │
└─────────┬───────────────────┬────────────────────────────┘
          │                   │
┌─────────▼──────┐   ┌────────▼──────────────────────────┐
│  ANTHROPIC API │   │         SUPABASE (PostgreSQL)      │
│  claude-3-5-   │   │  ├── 16 tables, pgvector enabled  │
│  sonnet via    │   │  ├── AES-256-GCM encrypted PHI     │
│  Zero-Retention│   │  ├── Cursor-based pagination       │
│  endpoint      │   │  └── Audit log with entry hashes  │
└────────────────┘   └───────────────────────────────────┘
          │
┌─────────▼──────┐
│  DEEPGRAM API  │
│  nova-3-medical│
│  WebSocket STT │
└────────────────┘
```

### Multi-Tenancy Model
Every database table includes a `practice_id` column. All queries are scoped by `practiceId` extracted from the authenticated session — never from request parameters. This is the primary tenant isolation control.

---

## 3. Tech Stack

### Runtime Dependencies

| Package | Version | Purpose |
|---|---|---|
| `next` | ^15.1.0 | App Router framework, RSC, API routes |
| `react` / `react-dom` | ^18.3.1 | UI rendering |
| `@clerk/nextjs` | ^6.38.3 | Authentication, session management |
| `@prisma/client` | ^5.22.0 | Type-safe DB ORM |
| `@anthropic-ai/sdk` | ^0.32.1 | Claude API (note gen, coding, prior auth) |
| `@deepgram/sdk` | ^3.9.0 | Medical speech-to-text |
| `zod` | ^3.23.8 | Runtime schema validation |
| `@tanstack/react-query` | ^5.65.1 | Client-side data fetching + caching |
| `@tanstack/react-table` | ^8.20.6 | Data tables (encounters, patients) |
| `@tiptap/react` | ^2.11.0 | Rich text editor for note editing |
| `recharts` | ^2.14.1 | Analytics charts |
| `bullmq` | ^5.34.5 | Async job queues (AI processing) |
| `ioredis` | ^5.4.1 | Redis client (sessions, queues) |
| `stripe` | ^17.4.0 | Billing + subscriptions |
| `fhir-kit-client` | ^1.9.2 | FHIR R4 EHR integration |
| `otplib` | ^12.0.1 | TOTP MFA |
| `winston` | ^3.17.0 | Structured logging |
| `bcryptjs` | ^2.4.3 | Password hashing |
| `jose` | ^5.9.6 | JWT handling |
| `next-auth` | ^4.24.10 | Legacy auth (being replaced by Clerk) |
| `@aws-sdk/client-s3` | ^3.717.0 | Audio file storage |
| `@aws-sdk/client-kms` | ^3.717.0 | Key management |

### Dev Dependencies

| Package | Purpose |
|---|---|
| `vitest` | Unit + integration tests |
| `@playwright/test` | E2E tests |
| `prisma` | CLI for migrations, studio |
| `typescript` | Strict mode enabled |

### Infrastructure

| Layer | Technology |
|---|---|
| Database | Supabase (PostgreSQL 15 + pgvector) |
| Connection | PgBouncer transaction mode (port 6543) at runtime; session mode (port 5432) for migrations |
| Auth | Clerk (hosted, replaces custom NextAuth flow) |
| Object Storage | AWS S3 (audio files, supporting docs) |
| Job Queue | Redis + BullMQ |
| Monitoring | (Datadog / Sentry — not yet wired) |

---

## 4. Authentication & Authorization

### Authentication — Clerk

All authentication is handled by Clerk. The middleware in `src/middleware.ts` protects all routes except:

```
/ | /sign-in | /sign-up | /api/** | /pricing | /demo | /industry-use
```

Protected routes call `auth.protect()` via `clerkMiddleware`, which redirects unauthenticated users to `/sign-in`.

**Sign-in URL:** `/sign-in` → `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
**Post-auth redirect:** `/dashboard` → `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`

### Authorization — RBAC

Defined in `src/lib/auth/rbac.ts`. Five roles with a permission matrix:

| Resource | provider | admin | biller | staff | superadmin |
|---|---|---|---|---|---|
| `own_encounters` | CRUD | R | R | R | R |
| `other_encounters` | — | R | R | — | R |
| `patients` | CRU | R | R | CR | R |
| `ai_note_gen` | execute | — | — | — | — |
| `coding` | CRUD | R | CRUD | — | R |
| `prior_auth` | R | CRUD | CRUD | C | R |
| `compliance` | R | CRUD | R | — | CRUD |
| `analytics` | R | R | R | — | R |
| `user_management` | — | CRUD | — | — | CRUD |
| `practice_settings` | — | CRUD | — | — | CRUD |
| `billing` | — | CRUD | R | — | CRUD |
| `audit_logs` | — | R | — | — | R |
| `system_config` | — | — | — | — | CRUD |

Usage:
```typescript
import { hasPermission, requirePermission } from "@/lib/auth/rbac";

// Soft check
if (!hasPermission(userRole, "coding", "create")) return 403;

// Hard check (throws FORBIDDEN)
requirePermission(userRole, "prior_auth", "update");
```

---

## 5. Data Model

Defined in `prisma/schema.prisma`. 16 tables across 4 domains.

### Core Tables

```
practices          — Multi-tenant root; all queries scoped here
users              — Practice members (provider/admin/biller/staff/superadmin)
sessions           — Auth sessions (15-min idle timeout)
patients           — PHI encrypted at column level
encounters         — Clinical visits (status workflow)
encounter_notes    — AI draft + provider-edited note (PHI encrypted)
encounter_codes    — CPT/ICD-10/HCPCS suggestions + provider decisions
ai_interactions    — Every Claude/Deepgram call logged (prompt hash, tokens, latency)
```

### Compliance Tables
```
prior_auth_requests  — PA lifecycle (not_required → submitted → approved/denied)
claim_submissions    — Claim status and denial tracking
payer_rules          — Payer-specific coding rules
compliance_alerts    — PIPEDA/HIA checks, provincial college flags, documentation gaps
audit_log            — Tamper-evident log of every PHI access/mutation
```

### AI / Knowledge Tables
```
specialty_templates  — Note templates per specialty/type/format
knowledge_chunks     — RAG knowledge base (pgvector embeddings, 1536-dim)
analytics_events     — Product analytics
```

### Encounter Status Workflow

```
not_started → in_progress → ai_processing → needs_review → note_finalized → finalized
```

### Key Design Rules
- `practice_id` on every table — scopes all queries
- `deleted_at` soft-delete on all core entities — PHI is never hard deleted
- Cursor-based pagination on all list endpoints (never offset)
- `updated_at` auto-managed by Prisma `@updatedAt`

---

## 6. PHI Encryption

Implemented in `src/lib/db/encryption.ts`.

### Algorithm
**AES-256-GCM** with a 16-byte random IV per field. Provides both confidentiality and integrity (authenticated encryption).

### Key Derivation
```typescript
// APP_SECRET env var → SHA-256 → 32-byte DEK
const dek = createHash("sha256").update(process.env.APP_SECRET).digest();
```

### Wire Format
Each encrypted field is stored as a JSON string:
```json
{
  "ciphertext": "<base64>",
  "iv": "<base64 16 bytes>",
  "authTag": "<base64 16 bytes>",
  "keyVersion": 1
}
```

### Encrypted PHI Fields

| Model | Encrypted Columns |
|---|---|
| `Patient` | `firstName`, `lastName`, `dob`, `phone`, `email`, `address`, `insuranceJson` |
| `User` | `firstName`, `lastName`, `mfaSecret` |
| `EncounterNote` | `rawTranscript`, `aiGeneratedNote`, `providerEditedNote` |
| `PriorAuthRequest` | `clinicalSummary` |

### Usage Pattern
```typescript
// Write
await prisma.patient.create({
  data: { firstName: encryptPHI(firstName), ... }
});

// Read (returns null instead of throwing on bad ciphertext)
const name = decryptPHISafe(patient.firstName) ?? "[encrypted]";
```

---

## 7. AI System

### Models

| Task | Model | Max Tokens | SLA |
|---|---|---|---|
| Clinical note generation | `claude-3-5-sonnet-20241022` | 4096 | < 15s |
| Billing code suggestion | `claude-3-5-sonnet-20241022` | 2048 | < 5s |
| Prior auth summary | `claude-3-5-sonnet-20241022` | 3000 | < 20s |
| Speech-to-text | Deepgram `nova-3-medical` | — | Real-time |

> **Note:** CLAUDE.md specifies `claude-sonnet-4-6` as the target model. The current code uses `claude-3-5-sonnet-20241022` — migration to `claude-sonnet-4-6` is pending.

### Prompt Architecture

```
BASE_CLINICAL_SYSTEM_PROMPT
  └── BEHAVIORAL_HEALTH_LAYER  (when specialty === "behavioral_health")
      └── CODING_SYSTEM_PROMPT (for code suggestion tasks)
          └── PRIOR_AUTH_SYSTEM_PROMPT (for PA generation)
```

Defined in `src/lib/ai/prompts/base-system.ts` and `src/lib/ai/prompts/prior-auth.ts`.

### PHI Minimization (PIPEDA/HIA Compliance)
Patient identifiers (name, PHN, MRN, DOB) are stripped before sending to Claude. Only de-identified demographics are passed:

```typescript
const ctxBlock = `
Age: ${ctx.ageYears}
Biological sex: ${ctx.biologicalSex}
Chief complaint: ${ctx.chiefComplaint}
Current diagnoses: ${ctx.priorDiagnoses.join(", ")}
`;
```

### AI Interaction Logging
Every Claude call records to `ai_interactions`:
- `promptHash` — SHA-256 of system + user prompt (not the prompt text itself)
- `outputHash` — SHA-256 of output
- `inputTokens`, `outputTokens`, `latencyMs`
- `modelVersion`
- `providerAction` — accepted | modified | rejected (set after provider review)

### Code Suggestion Output Contract
```typescript
{
  suggestions: [{
    codeType: "CPT" | "ICD10" | "HCPCS",
    code: string,
    description: string,
    modifier: string | null,
    units: number,
    confidence: number,      // 0.0–1.0
    rationale: string        // cites specific note language
  }],
  emLevel: string | null,
  emJustification: string | null,
  denialRiskFlags: string[]
}
```

### Real-Time Transcription (Deepgram)
- Browser opens WebSocket to `/api/deepgram` to get a short-lived API key
- Client connects directly to Deepgram WebSocket: `wss://api.deepgram.com/v1/listen?model=nova-3-medical&smart_format=true&interim_results=true`
- Auth via subprotocol: `['token', key]`
- Audio chunks sent every 250ms via `MediaRecorder`
- MIME type selection uses `MediaRecorder.isTypeSupported()` fallback chain: `audio/webm;codecs=opus` → `audio/webm` → `audio/ogg;codecs=opus` → `audio/mp4`

---

## 8. API Design

### Response Envelope
All API routes return a consistent shape defined in `src/types/api.ts`:
```typescript
// Success
{ data: T, error: null, meta?: Record<string, unknown> }

// Error
{ data: null, error: string, meta?: Record<string, unknown> }
```

Helpers: `apiOk(data)` and `apiErr(message)`.

### Implemented Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/api/encounters` | Clerk | List encounters (cursor-paginated) |
| `POST` | `/api/encounters` | Clerk | Create encounter + initial note record |
| `GET` | `/api/encounters/[id]/codes` | Clerk | Get coding suggestions for encounter |
| `POST` | `/api/encounters/[id]/notes/[noteId]/finalize` | Clerk | Finalize note (provider approval required) |
| `GET` | `/api/patients` | Clerk | List patients (practice-scoped) |
| `GET` | `/api/compliance` | Clerk | Compliance alerts |
| `POST` | `/api/ai/generate-note` | Clerk | Generate clinical note from transcript |
| `POST` | `/api/ai/suggest-codes` | Clerk | Suggest billing codes from note |
| `POST` | `/api/ai/transcribe` | Clerk | Transcribe audio (batch) |
| `POST` | `/api/ai/prior-auth` | Clerk | Generate prior auth summary |
| `GET` | `/api/deepgram` | Clerk | Issue short-lived Deepgram key |
| `POST` | `/api/webhooks/stripe` | Stripe sig | Handle subscription events |
| `GET/POST` | `/api/auth/[...nextauth]` | — | NextAuth session (legacy) |
| `GET` | `/api/demo` | — | Public demo data |

### Validation Pattern
All POST/PUT/PATCH bodies are validated with Zod before processing:
```typescript
const schema = z.object({ ... });
const parsed = schema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json(apiErr(parsed.error.message), { status: 422 });
}
```

### Pagination
Cursor-based on all list endpoints:
```typescript
// Request
GET /api/encounters?cursor=<uuid>&limit=20

// Response
{ items: [...], nextCursor: "<uuid>|null", hasMore: boolean }
```

---

## 9. Real-Time Audio & Transcription

### Flow

```
Browser (MediaRecorder)
  ↓  audio chunks every 250ms
Deepgram WebSocket (wss://api.deepgram.com)
  ↓  JSON transcript events
ActiveScribe component
  ↓  interim_results shown live; is_final appended to transcript
Provider reviews transcript
  ↓
POST /api/ai/generate-note
  ↓
Claude API → AI draft note
  ↓
Provider edits in TipTap editor → approves
  ↓
POST /api/encounters/[id]/notes/[noteId]/finalize
```

### Components
- `src/components/dashboard/ActiveScribe.tsx` — WebSocket lifecycle, transcript preview, scribe button
- `src/components/dashboard/VolumeVisualizer.tsx` — Real-time audio level visualization
- `src/hooks/useMicrophone.ts` — `getUserMedia` wrapper
- `src/app/(dashboard)/encounters/[id]/components/AudioRecorder.tsx` — Full encounter recorder
- `src/app/(dashboard)/encounters/[id]/components/NoteEditor.tsx` — TipTap rich text editor
- `src/app/(dashboard)/encounters/[id]/components/CodingSuggestions.tsx` — Code review UI

---

## 10. Privacy & Compliance Controls

### Audit Logging
Every PHI read or write calls `writeAuditLog()` from `src/lib/db/audit.ts`. Each entry includes:
- `practiceId`, `userId`, `userRole`, `sessionId`
- `action` (CREATE/READ/UPDATE/DELETE/EXPORT/etc.)
- `resource` + `resourceId`
- `ipAddress`, `userAgent`
- `fieldsAccessed` or `fieldsChanged` (field names only — never values)
- `entryHash` — SHA-256 of entry content for tamper detection
- `outcome` — success | failure | denied

Audit logging is fail-safe: errors are caught and logged to console but never propagate to crash the request.

### PHI in Logs — Zero Tolerance
```typescript
// CORRECT
logger.info("Note updated", { encounterId, fieldsChanged: ["providerEditedNote"] });

// NEVER
logger.info("Note updated", { patientName: "John Smith" }); // ← forbidden
```

### Auto-Finalize Prevention
AI-generated notes are always stored as drafts. Finalization requires an explicit provider action (`POST .../finalize`). The finalization route sets `finalizedAt` and `finalizedBy`.

### Compliance Modules
- `src/lib/compliance/pipeda-checks.ts` — Automated PIPEDA control checks
- `src/lib/compliance/oig-screening.ts` — Provincial college good-standing screening
- `src/lib/compliance/payer-validation.ts` — Pre-submission claim validation

### Canadian Compliance (PIPEDA/Alberta HIA)
The AI client (`src/lib/ai/anthropic.ts`) documents that:
- Only de-identified demographics (age, sex, chief complaint) are sent to Claude
- Direct identifiers (name, PHN) are withheld
- **TODO:** Migrate to AWS Bedrock `ca-central-1` (Montreal) for full HIA data residency

---

## 11. Environment Configuration

### `.env` (committed as template, real values in `.env.local`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PgBouncer transaction pooler (port 6543) — Prisma runtime |
| `DIRECT_URL` | Session-mode pooler (port 5432) — Prisma CLI migrations |
| `APP_SECRET` | AES-256 PHI encryption key derivation (must be 32+ chars) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend key |
| `CLERK_SECRET_KEY` | Clerk backend key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/dashboard` |
| `ANTHROPIC_API_KEY` | Claude API — zero-retention endpoint |
| `DEEPGRAM_API_KEY` | Deepgram STT — nova-3-medical model |
| `NEXTAUTH_SECRET` | NextAuth JWT signing (legacy, alongside Clerk) |
| `REDIS_URL` | BullMQ job queues |
| `AWS_S3_BUCKET` | Audio file + document storage |
| `STRIPE_SECRET_KEY` | Subscription billing |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |

### Supabase Connection Setup
Supabase requires two separate URLs:
- **Runtime** (`DATABASE_URL`, port 6543): PgBouncer transaction mode. Add `&pgbouncer=true` to disable prepared statements.
- **Migrations** (`DIRECT_URL`, port 5432): Session-mode pooler. Used by `prisma migrate deploy` and `prisma generate`.

---

## 12. Development Workflow

### Setup
```bash
npm install
cp .env.local.example .env.local   # fill in real keys
npx prisma migrate deploy           # apply migrations to Supabase
npm run seed                        # seed demo practice + users
npm run dev
```

### Key Scripts
```bash
npm run dev                     # Next.js dev server (localhost:3000)
npm run build                   # Production build
npm run typecheck               # tsc --noEmit (strict)
npm run test                    # Vitest unit tests
npm run test:e2e                # Playwright E2E
npm run db:migrate              # prisma migrate dev (creates new migration)
npm run db:studio               # Prisma Studio GUI
npm run seed                    # Seed demo data
npm run generate-embeddings     # Populate pgvector knowledge base
```

### Branch Naming
```
feature/encounter-documentation
fix/coding-confidence-score
chore/update-dependencies
```

### Commit Convention (Conventional Commits)
```
feat: add Deepgram speaker diarization
fix: scope encounter queries by practiceId
chore: rotate Stripe webhook secret
```

---

## 13. Implementation Status

### Completed
- [x] Next.js 15 App Router scaffold with TypeScript strict mode
- [x] Clerk authentication (sign-in, sign-up, middleware protection)
- [x] Prisma schema — all 16 tables, enums, indexes
- [x] Supabase database provisioned + migration applied
- [x] AES-256-GCM PHI encryption (`encryptPHI` / `decryptPHISafe`)
- [x] RBAC permission matrix (5 roles, 14 resources)
- [x] Tamper-evident audit logging (`writeAuditLog`)
- [x] Encounter API (GET/POST with cursor pagination, practiceId scoping, PHI decryption)
- [x] Claude integration — note generation, code suggestion, prior auth summary
- [x] Deepgram real-time WebSocket transcription (`ActiveScribe` component)
- [x] Dashboard UI — ClinicalMetrics, EncounterList, ActiveScribe, ComplianceModule, AIInsightsSidebar
- [x] Encounters page, Patients page, Compliance page, Prior Auth page, Analytics page
- [x] Settings pages (Practice, Users, Billing)
- [x] New encounter form (`/encounters/new`)
- [x] Encounter detail page with audio recorder, note editor, coding suggestions
- [x] FHIR R4 client (`fhir-kit-client`)
- [x] Stripe billing client + webhook handler
- [x] Marketing pages (landing, pricing, demo, industry-use)
- [x] Provincial college screening + PIPEDA/HIA compliance check modules
- [x] BullMQ + Redis job queue setup
- [x] Winston structured logger

### In Progress
- [ ] Clerk ↔ Prisma user sync (currently uses `findFirst({ active: true })` placeholder)
- [ ] TOTP MFA enrollment + verification UI (`/mfa/verify` exists, enrollment flow TBD)
- [ ] Payer rules database population
- [ ] Knowledge base embedding generation (`generate-embeddings` script)
- [ ] RAG retrieval pipeline integration into note generation

### Not Started
- [ ] FHIR bidirectional sync (push finalized notes back to EHR)
- [ ] Denial prevention engine (pre-submission claim analysis)
- [ ] Revenue-share billing via Stripe usage
- [ ] Mobile PWA / React Native companion
- [ ] Automated evaluation suite (golden test set for AI quality)
- [ ] SOC 2 Type I audit preparation

---

## 14. Known Gaps & TODOs

### Critical (Blocks Production)

1. **Clerk ↔ DB user sync** — `src/app/api/encounters/route.ts` uses `prisma.user.findFirst({ where: { active: true } })` as a placeholder. In production, the Clerk `userId` (from `auth()`) must be matched to the `users` table via a `clerkId` column (not yet in schema) or email.

2. **`APP_SECRET` rotation** — Current dev value is a placeholder string. Production requires a cryptographically random 256-bit value and a key rotation strategy for re-encrypting PHI.

3. **MFA enforcement** — Clerk handles auth but TOTP MFA enrollment is not yet enforced for all users. PIPEDA and provincial health privacy law require MFA with no bypass path.

4. **AI model version** — `src/lib/ai/anthropic.ts` hardcodes `claude-3-5-sonnet-20241022`. CLAUDE.md specifies `claude-sonnet-4-6` as the target.

### Security Hardening

5. **API routes missing practiceId from session** — Several routes look up the user without linking Clerk `userId` to a `practiceId`, meaning the tenant scope relies on the first active user found. This must be fixed before any multi-practice deployment.

6. **Security headers** — `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options` not yet applied via Next.js config.

7. **Rate limiting** — No rate limiting on AI endpoints. Required before public launch.

### Data Residency (Canadian Deployments)

8. **AWS Bedrock migration** — For Alberta HIA / PIPEDA data residency, Claude calls must route through AWS Bedrock in `ca-central-1` instead of the Anthropic API directly.

### Infrastructure

9. **Redis not yet required** — BullMQ is installed but no jobs are being enqueued. The current AI calls are synchronous. Async job queue needed for note generation in production to avoid serverless timeout limits.

10. **S3 audio storage** — `audioFileKey` column exists on `encounters` but upload flow is not yet connected to the AWS S3 client.
