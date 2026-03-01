# SpecScribe — In-Depth Application Tutorial

> **Audience**: Providers, administrators, billers, and developers onboarding to SpecScribe.
> **Build status**: Phase 1 (MVP) + Phase 2 (Compliance & Revenue Recovery) fully complete.

---

## Table of Contents

1. [What SpecScribe Does](#1-what-specscribe-does)
2. [Getting Started — Login & MFA](#2-getting-started--login--mfa)
3. [Dashboard Navigation](#3-dashboard-navigation)
4. [Encounter Documentation Workflow](#4-encounter-documentation-workflow)
   - [4.1 Creating an Encounter](#41-creating-an-encounter)
   - [4.2 Step 1 — Audio Recording or Upload](#42-step-1--audio-recording-or-upload)
   - [4.3 Step 2 — Transcript & AI Note Review](#43-step-2--transcript--ai-note-review)
   - [4.4 Step 3 — AI Billing Code Suggestions](#44-step-3--ai-billing-code-suggestions)
5. [Encounters List](#5-encounters-list)
6. [Patient Roster](#6-patient-roster)
7. [Prior Authorizations](#7-prior-authorizations)
8. [Compliance Dashboard](#8-compliance-dashboard)
9. [Analytics](#9-analytics)
10. [Settings — Team Members](#10-settings--team-members)
11. [Settings — Billing](#11-settings--billing)
12. [Settings — Practice Configuration](#12-settings--practice-configuration)
13. [AI System Deep Dive](#13-ai-system-deep-dive)
14. [Security & HIPAA Architecture](#14-security--hipaa-architecture)
15. [API Reference Overview](#15-api-reference-overview)
16. [Role Permissions Reference](#16-role-permissions-reference)
17. [Local Development Setup](#17-local-development-setup)

---

## 1. What SpecScribe Does

SpecScribe is a specialty-focused clinical documentation and compliance platform. It sits **on top of your existing EHR** as an intelligence layer — it does not replace Epic, athenahealth, or any other EHR system.

### Core value chain

```
Patient encounter
      ↓
  Audio recording (browser mic or uploaded file)
      ↓
  Deepgram nova-2-medical transcription (speaker-diarized)
      ↓
  Claude AI generates a structured clinical note (SOAP/DAP/BIRP/Narrative)
      ↓
  Provider reviews, edits, and finalizes the note
      ↓
  Claude AI suggests CPT + ICD-10 billing codes with confidence scores & denial risk flags
      ↓
  Provider accepts / rejects codes → claim submitted
      ↓
  Prior auth automation (where required)
      ↓
  HIPAA compliance monitoring + audit trail
      ↓
  Analytics: documentation time, denial rate, AI accuracy
```

### Specialty focus (Phase 1)

The platform currently targets **behavioral health** practices (psychiatry, psychotherapy, counseling). Expansion verticals — dermatology, orthopedics, pain management, oncology — are planned for Phase 3.

---

## 2. Getting Started — Login & MFA

### Registration (`/register`)

New practices register by providing:
- Practice name, NPI, and specialty
- Admin user email and password
- Stripe subscription tier (Basic / Professional / Enterprise)

NPI format is validated at registration. The practice record is created and the first admin user is provisioned.

### Login (`/login`)

Standard email + password login powered by **NextAuth.js**. Sessions use JWTs with a `practiceId` claim baked in — every downstream DB query is automatically scoped to that practice.

### MFA Verification (`/mfa/verify`)

**MFA is mandatory for all users** — this is a HIPAA 2025 NPRM requirement baked directly into the auth flow. After password login, users must pass TOTP (Time-Based One-Time Password) verification:

1. First login: A QR code is presented. Scan it with Google Authenticator, Authy, or any TOTP app.
2. Subsequent logins: Enter the 6-digit code from the authenticator app.
3. Session is not issued (and no PHI is accessible) until MFA passes.

### Session timeouts

| Timeout type | Duration |
|---|---|
| Idle timeout | 15 minutes |
| Absolute max session | 24 hours |

After idle timeout, the user is redirected to `/login`. All session state is stored securely via NextAuth with `httpOnly`, `secure`, and `sameSite=strict` cookie flags.

---

## 3. Dashboard Navigation

After login, users land in the **dashboard layout** (`src/app/(dashboard)/layout.tsx`) with a persistent sidebar (`src/components/layout/Sidebar.tsx`). Navigation links:

| Section | URL | Who uses it |
|---|---|---|
| Encounters | `/encounters` | Providers, Staff |
| Patients | `/patients` | Providers, Staff |
| Prior Auth | `/prior-auth` | Billers, Providers |
| Compliance | `/compliance` | Admins, Providers |
| Analytics | `/analytics` | Admins, Providers |
| Team | `/settings/users` | Admins |
| Billing | `/settings/billing` | Admins |
| Practice | `/settings/practice` | Admins |

---

## 4. Encounter Documentation Workflow

This is the core feature of the platform. Every clinical encounter flows through a **three-step pipeline** implemented in `src/app/(dashboard)/encounters/[id]/page.tsx`.

A progress stepper at the top of the page shows where you are:

```
[ 1. Record ] ——— [ 2. Review note ] ——— [ 3. Billing codes ]
```

Steps unlock sequentially: you cannot advance to step 2 without a completed transcript, and you cannot advance to step 3 without a finalized note.

---

### 4.1 Creating an Encounter

Navigate to `/encounters/new`. Fill in:
- Patient (select from roster or create new)
- Encounter date
- Specialty type (behavioral_health, dermatology, etc.)
- Provider (defaults to the logged-in provider)

On submit, the encounter is created with status `not_started` and you are redirected to `/encounters/{id}`.

---

### 4.2 Step 1 — Audio Recording or Upload

**Component**: `src/app/(dashboard)/encounters/[id]/components/AudioRecorder.tsx`

The audio recorder has two modes:

#### Live Recording

1. Click **Start recording** (red button).
2. The browser requests microphone access via `navigator.mediaDevices.getUserMedia`.
3. Audio is captured in 1-second chunks using the browser's native `MediaRecorder` API (`audio/webm` format).
4. A live timer displays the recording duration (e.g., `3:47`).
5. Click **Stop & transcribe** to end the session.

#### File Upload

Click **Upload audio** to upload a pre-recorded audio file (any format: `.mp3`, `.wav`, `.m4a`, `.webm`, `.ogg`). This supports dictation recorders and uploaded session recordings.

#### What happens after stopping

Both paths send the audio to `/api/ai/transcribe` as a `multipart/form-data` POST. The API:
1. Forwards the audio to **Deepgram nova-2-medical** — a medical-domain-optimized speech-to-text model.
2. Speaker diarization is applied, separating the provider's voice from the patient's voice.
3. Returns a full transcript string plus timestamped segments with speaker labels.
4. The UI advances automatically to **Step 2**.

> **Privacy note**: Audio is encrypted in transit (TLS 1.3) and processed with zero data retention. Audio recordings are stored in S3 with SSE-KMS encryption and scoped to your practice.

---

### 4.3 Step 2 — Transcript & AI Note Review

**Components**: `TranscriptViewer.tsx` + `NoteEditor.tsx`

#### Transcript Viewer

The transcript is displayed with:
- Full text of the conversation
- Timestamped segments (e.g., `[0:45] Provider: "How have you been sleeping?..."`)
- Speaker labels (Provider vs. Patient)

#### Note Editor

The note editor is a **Tiptap rich text editor** that supports full formatting (headings, bold, lists). It has two action buttons:

**"Generate with AI"** — calls `/api/ai/generate-note`:
- Sends the transcript + patient context (age, sex, prior diagnoses, medications, chief complaint) to **Claude claude-sonnet-4-6**.
- The AI uses a layered prompt: base clinical prompt → specialty layer (behavioral health) → note type layer (SOAP/DAP/BIRP) → provider preference layer.
- Returns a structured clinical note, which loads directly into the editor.
- A toast notification shows generation latency (e.g., "Note generated in 8.2s").

**"Finalize & sign"** — calls `/api/encounters/{id}/notes/{noteId}/finalize`:
- Captures the final HTML content from the editor.
- Writes the `providerEditedNote` (encrypted AES-256-GCM) to the database.
- Sets `finalizedAt` timestamp on the `EncounterNote` record.
- Calculates and stores the `aiAcceptanceRate` (how much of the AI draft was retained).
- Advances the encounter status to `note_finalized`.
- Unlocks **Step 3**.

> **Important**: The AI note is always a **draft**. The "Finalize & sign" action is the provider's explicit attestation. Nothing auto-submits or auto-finalizes.

#### Note formats supported

| Format | Use case |
|---|---|
| SOAP | Subjective, Objective, Assessment, Plan |
| DAP | Data, Assessment, Plan (common in behavioral health) |
| BIRP | Behavior, Intervention, Response, Plan |
| NARRATIVE | Free-form clinical narrative |

---

### 4.4 Step 3 — AI Billing Code Suggestions

**Component**: `src/app/(dashboard)/encounters/[id]/components/CodingSuggestions.tsx`

After the note is finalized, click **"Suggest codes"** to run the coding engine.

#### What the AI analyzes

The `/api/ai/suggest-codes` API sends the finalized note text (PHI-minimized) to Claude, which:
1. Identifies all billable services performed.
2. Suggests CPT codes (with modifiers: -25, -59, -76, -77 where applicable).
3. Suggests ICD-10 diagnosis codes.
4. Determines the E/M (Evaluation & Management) level with justification.
5. Assigns a **confidence score** (0–100%) to each code.
6. Flags **denial risk** based on payer-specific rules from the `PayerRule` database.

#### Reading the output

Each suggested code card shows:

```
90837-59   [CPT]   × 1     92% confidence
Individual Psychotherapy, 60 min
"Note documents 60-minute session with individual patient,
 documented start and end time"
```

- **Code + modifier**: e.g., `90837-59`
- **Code type badge**: CPT, ICD-10, or HCPCS
- **Units**: for time-based codes
- **Confidence badge**: Green ≥80%, Yellow ≥50%, Red <50%
- **Description**: human-readable code description
- **Rationale**: the specific note language that justified this code (transparency principle)

#### Denial risk flags

If the AI detects potential payer-specific denial risks, they appear in an orange warning box above the code cards. Examples:
- "Modifier -25 requires separate E/M documentation from the procedure note"
- "Anthem requires prior authorization for psychotherapy sessions > 52 min after the first 6 sessions"

#### Accepting / Rejecting codes

Each code card has:
- **Check (✓)** — accept the code. This writes an `EncounterCode` record with `providerAccepted: true`. The system learns from accepted codes.
- **X** — reject the code. Records `providerAccepted: false`. Fades the card out. System learns from rejections.

Accepted/rejected code decisions drive the AI's learning loop — over time, the system personalizes suggestions to match each provider's coding patterns.

---

## 5. Encounters List

**Route**: `/encounters`
**File**: `src/app/(dashboard)/encounters/page.tsx`

The encounters list is a **server-rendered page** that fetches the practice's encounters directly from PostgreSQL — no client-side fetching.

### What you see

A table with columns:
| Column | Description |
|---|---|
| Patient | Decrypted last name, first name + MRN |
| Date | Encounter date formatted as "Feb 25, 2026" |
| Provider | Provider name and credentials |
| Status | Color-coded status badge |
| Action | "Open →" link to the encounter detail |

### Status badge colors

| Status | Color | Meaning |
|---|---|---|
| Not started | Grey | Encounter created, no audio yet |
| In progress | Yellow | Audio recording in progress |
| AI processing | Blue | Transcription or note generation running |
| Needs review | Orange | AI has generated output; provider must review |
| Note finalized | — | Note signed; ready for coding |
| Finalized | Green | Note and codes complete |

The list is scoped strictly to your `practiceId` — providers at other practices cannot see your encounters. The list loads the 50 most recent encounters ordered by date descending.

---

## 6. Patient Roster

**Route**: `/patients`

The patient roster displays all patients registered to the practice. Patient PII (first name, last name, DOB, phone, email) is encrypted at rest using AES-256-GCM — the server decrypts it at render time using `decryptPHISafe()`.

### Patient fields stored

| Field | Encrypted? |
|---|---|
| MRN (Medical Record Number) | No (identifier only) |
| First name, Last name | Yes |
| Date of birth | Yes |
| Phone, Email | Yes |
| Address | Yes |
| Insurance JSON | Yes |
| FHIR ID (from EHR) | No |

### Creating a patient

From `/patients`, click "New patient". Provide demographics and insurance information. The system stores encrypted PHI and generates a unique MRN.

---

## 7. Prior Authorizations

**Route**: `/prior-auth`
**File**: `src/app/(dashboard)/prior-auth/page.tsx`

### Overview

The prior auth page shows all PA requests across the practice with real-time status tracking.

#### Summary stats (top cards)

- **Pending / In review**: requests awaiting payer decision
- **Approved**: approved PAs (with auth numbers)
- **Denied**: denied PAs (eligible for appeal)

#### Status lifecycle

```
pending_submission → submitted → under_review → approved
                                              → denied → appealed
```

| Status | Color | Meaning |
|---|---|---|
| pending_submission | Yellow | PA needed; form not yet sent |
| submitted | Blue | Sent to payer |
| under_review | Purple | Payer is reviewing |
| approved | Green | Approved with auth number |
| denied | Red | Denied — appeal letter available |
| appealed | Orange | Appeal submitted |
| expired | Grey | Auth number expired |

#### AI-generated PA forms

When a PA is required for an encounter, the system calls `/api/ai/prior-auth`. Claude reads:
- The finalized encounter note
- The payer's PA requirements (from the `PayerRule` database)
- The patient's clinical history

And produces a completed PA form with:
- Clinical summary (encrypted at rest)
- Medical necessity justification
- Supporting clinical evidence from the note
- Attached procedure codes

The provider reviews and submits. If denied, Claude generates an **appeal letter** using the denial reason and clinical documentation.

#### Industry impact

The industry average for PA turnaround is 3–5 days and 35+ staff-hours per week. SpecScribe targets **< 24 hours** and near-zero manual effort.

---

## 8. Compliance Dashboard

**Route**: `/compliance`
**File**: `src/app/(dashboard)/compliance/page.tsx`

### Compliance score

A percentage score calculated from automated HIPAA checks run via `src/lib/compliance/hipaa-checks.ts`. The score bar color indicates:
- **Green**: ≥ 80% — compliant
- **Yellow**: 60–79% — attention needed
- **Red**: < 60% — critical action required

### HIPAA security checks

The system runs a suite of automated checks against your practice configuration. Each check shows:
- Check name
- Pass (green shield) or Fail (warning icon)
- Severity: `info`, `warning`, or `critical`
- Description of what is being checked
- **Remediation steps** if the check fails

Example checks:
- MFA enabled for all users
- Session idle timeout configured (≤ 15 min)
- Audit logging active
- PHI encryption keys rotated within 90 days
- All users have accepted HIPAA training acknowledgment

### Active alerts

Below the checks, active (unresolved) compliance alerts are shown. Alerts are generated automatically by the system and can also be triggered by system events. Alert severities:
- `info` (blue) — informational, no urgent action
- `warning` (yellow) — should be addressed within 30 days
- `critical` (red) — must be addressed immediately

### OIG exclusion screening

The compliance module (`src/lib/compliance/oig-screening.ts`) screens all providers and staff against the OIG (Office of Inspector General) exclusion list. Being excluded from Medicare/Medicaid programs is a federal violation. SpecScribe automates this check so practices don't face liability from inadvertently employing or contracting with excluded individuals.

### Payer validation

`src/lib/compliance/payer-validation.ts` validates claims against payer-specific rules before submission, flagging:
- Modifier misuse (e.g., -25 without separate E/M)
- Missing medical necessity language
- Prior auth not obtained before service

---

## 9. Analytics

**Route**: `/analytics`
**File**: `src/app/(dashboard)/analytics/page.tsx`

The analytics page provides a real-time view of practice performance and AI system health. All metrics are scoped to your practice.

### Live metrics (top grid)

| Metric | How calculated |
|---|---|
| Encounters this month | Count from `encounters` table for current calendar month |
| Month-over-month growth | % change vs. previous month's encounter count |
| Finalized notes | All-time count of notes with `finalizedAt` set |
| AI interactions | Count of `AIInteraction` records (note gen + coding calls) |
| Denial rate | `denied_claims / total_claims * 100%` |

### AI performance targets

The system tracks four key AI quality SLAs:

| Metric | Target | How tracked |
|---|---|---|
| Note acceptance rate | > 80% | % of AI notes accepted without major edits (`aiAcceptanceRate` on `EncounterNote`) |
| Coding accuracy | > 90% | Alignment between AI code suggestions and provider's final code selections |
| Denial rate reduction | 40–60% | vs. practice baseline before SpecScribe |
| Prior auth turnaround | < 24 hours | Time from `createdAt` to `submittedAt` on `PriorAuthRequest` |

If acceptance rate drops below 70% or coding accuracy drops below 85%, alerts fire automatically.

---

## 10. Settings — Team Members

**Route**: `/settings/users`
**File**: `src/app/(dashboard)/settings/users/page.tsx`

### Access control

Only users with `admin` or `superadmin` roles can access this page. Access is enforced server-side via `requirePermission(role, "user_management", "read")`.

### User table

| Column | Description |
|---|---|
| Name | Decrypted first + last name, with credentials |
| Email | Login email |
| Role | Color-coded badge (provider/admin/biller/staff) |
| MFA | Green ✓ or Red ✗ — shows HIPAA compliance status |
| Last login | Date of most recent authenticated session |
| Status | Active / Inactive |

### Roles explained

| Role | Color | Access level |
|---|---|---|
| provider | Blue | Own patients + encounters only |
| admin | Purple | Full practice management |
| biller | Orange | Billing codes, claims, prior auth |
| staff | Grey | Scheduling and patient intake |
| superadmin | Red | Cross-practice access (SpecScribe staff only) |

### HIPAA reminder banner

A yellow banner reminds admins that **MFA is mandatory for all users** under the 2025 HIPAA NPRM. Users with MFA disabled also appear as a `warning` alert on the Compliance Dashboard.

### Inviting users

Click **"+ Invite User"** to send an invitation email. The invited user registers, sets their password, and must complete MFA setup before accessing any PHI.

---

## 11. Settings — Billing

**Route**: `/settings/billing`

The billing settings page embeds the **Stripe Customer Portal** for self-service subscription management. Practices can:
- Upgrade or downgrade their subscription tier (Basic → Professional → Enterprise)
- View invoices and payment history
- Update payment method (credit card, ACH)
- Download receipts for accounting

### Subscription tiers

| Tier | Target | Features |
|---|---|---|
| Basic | 1–3 providers | Core documentation + coding |
| Professional | 4–15 providers | + Prior auth + compliance dashboard |
| Enterprise | 16+ providers | + Custom templates + analytics + FHIR sync |

Subscription events (upgrades, downgrades, payment failures) are processed via Stripe webhooks at `/api/webhooks/stripe/route.ts` and update the practice's `subscriptionTier` and `stripeSubscriptionStatus` fields.

---

## 12. Settings — Practice Configuration

**Route**: `/settings/practice`

Practice-level configuration including:
- Practice name, specialty, NPI, tax ID
- Address and contact information
- Note format preferences (SOAP/DAP/BIRP default)
- Payer list (which payers are active for this practice)
- EHR integration settings (FHIR base URL, client ID/secret for Epic/athenahealth)
- FHIR sync configuration (push finalized notes and codes back to the EHR)

### FHIR / EHR Integration

SpecScribe connects to EHRs via **SMART on FHIR R4**. The FHIR client (`src/lib/fhir/client.ts`) supports:
- Reading the daily patient schedule (Appointment resources)
- Reading patient demographics (Patient resources)
- Pushing finalized clinical notes back as FHIR `DocumentReference` resources
- Pushing accepted billing codes as `Claim` resources

FHIR mappers (`src/lib/fhir/mappers.ts`) translate SpecScribe's internal data model to/from the FHIR resource format.

---

## 13. AI System Deep Dive

### Model

All clinical AI tasks use **Anthropic Claude claude-sonnet-4-6** via the Anthropic API (not the consumer product). Zero data retention is configured — no prompt or response data is retained by Anthropic.

The Claude client is at `src/lib/ai/anthropic.ts`.

### Prompt architecture

Prompts are layered — each layer adds specificity:

```
BASE SYSTEM PROMPT
  (clinical documentation fundamentals, HIPAA awareness, "always draft" instruction)
  └── SPECIALTY LAYER
        (behavioral health: DSM-5 terminology, progress note conventions, CMHC standards)
        └── NOTE TYPE LAYER
              (SOAP format rules, DAP format rules, BIRP format rules)
              └── PAYER LAYER
                    (Medicare LCD requirements, Anthem policies, BCBS modifier rules)
                    └── PROVIDER PREFERENCE LAYER
                          (learned from this provider's accept/reject/edit history)
```

Base system prompt: `src/lib/ai/prompts/base-system.ts`
Prior auth prompt: `src/lib/ai/prompts/prior-auth.ts`

### RAG (Retrieval-Augmented Generation)

A knowledge base stored as vector embeddings in PostgreSQL (`pgvector` extension) provides the AI with real-time access to:
- CPT code guidelines and LCD/NCD coverage policies
- ICD-10 code trees and specificity rules
- Payer coverage policies (Medicare, Medicaid, major commercial payers)
- State-specific telehealth rules
- CMS and OIG guidance documents

Knowledge chunks are stored in the `KnowledgeChunk` table with `embedding vector(1536)` columns. At generation time, a **hybrid search** (vector similarity + BM25 keyword ranking) retrieves the most relevant chunks to include in the prompt.

Run `npm run generate-embeddings` to populate the knowledge base from source documents.

### Output validation

All AI-suggested CPT and ICD-10 codes are validated against the official code databases before being returned to the UI. If a code does not exist in the official database, it is flagged or discarded — this prevents hallucinated codes from reaching providers.

### Learning loop

The `AIInteraction` table records:
- `promptHash` and `outputHash` (for diff comparison)
- `modelVersion`
- `inputTokens`, `outputTokens` (for cost tracking)
- `latencyMs`
- `providerAction` (accepted / modified / rejected)

The `EncounterNote.aiAcceptanceRate` field captures what fraction of each AI-generated note was retained after provider edits. These signals are fed back into the PROVIDER PREFERENCE LAYER of future prompts, personalizing the AI's output to each clinician's documentation style.

### Latency and cost targets

| Operation | Target latency | Cost target |
|---|---|---|
| Note generation | < 15 seconds | < $1.50 |
| Coding suggestions | < 5 seconds | < $0.50 |
| Total per encounter | — | < $2.00 |

---

## 14. Security & HIPAA Architecture

### PHI encryption

Every field containing Protected Health Information (PHI) is encrypted at the application layer before being written to PostgreSQL — using **AES-256-GCM**. Encryption is handled by `src/lib/db/encryption.ts`.

Encrypted fields:

| Model | Encrypted Fields |
|---|---|
| Patient | firstName, lastName, dob, phone, email, address, insuranceJson |
| User | firstName, lastName, mfaSecret |
| EncounterNote | rawTranscript, aiGeneratedNote, providerEditedNote |
| PriorAuthRequest | clinicalSummary |

The encryption key is derived from `APP_SECRET` (a 256-bit random value in `.env`). The key must be rotated every 90 days as part of HIPAA key management requirements.

**Use `decryptPHISafe()`** in all UI and server components — it returns `null` on failure rather than throwing. Use `decryptPHI()` (throws) only in contexts where decryption failure should halt execution.

### Audit logging

Every read or write of PHI records an entry in the `AuditLog` table via `src/lib/db/audit.ts`. Each audit record includes:
- `practiceId`, `userId`
- `entityType` (patient, encounter, note, etc.) and `entityId`
- `action` (CREATE, READ, UPDATE, DELETE, EXPORT, AI_INVOCATION, etc.)
- `fieldsAccessed` and `fieldsChanged` (field names only — never values)
- `ipAddress` and `userAgent`
- `entryHash` (tamper-evident hash of the log entry)
- `timestamp`

Audit logs are retained for 10 years (exceeds the 7-year HIPAA minimum).

### Multi-tenant isolation

`practiceId` is on every database table and in every query. It is **extracted from the JWT session** at the API layer — never from request parameters, path variables, or request bodies. This guarantees that a malicious request cannot access another practice's data even if it contains a valid auth token.

### Security headers

Applied to all HTTP responses by `next.config.ts`:
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; ...
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
```

### Middleware

`src/middleware.ts` enforces:
- Valid NextAuth session on all `/dashboard` routes
- MFA verification before PHI access
- Session idle timeout (15 minutes)
- `practiceId` injection into every request context

### PHI minimization for AI

Before sending any content to Claude, the API strips direct patient identifiers (name, DOB, SSN, MRN, address). Only clinical content (symptoms, diagnoses, treatment details) is included in prompts. This complies with the HIPAA Safe Harbor de-identification standard.

---

## 15. API Reference Overview

All API routes are under `/api/`. Every route:
1. Validates the session and extracts `practiceId` from the JWT
2. Validates the request body with **Zod** schemas
3. Checks RBAC permissions before data access
4. Returns `{ data, error, meta }` envelope

### Authentication

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new practice + admin user |
| POST | `/api/auth/mfa/verify` | Verify TOTP code and issue full session |
| * | `/api/auth/[...nextauth]` | NextAuth.js provider (login, logout, session) |

### AI Services

| Method | Route | Description |
|---|---|---|
| POST | `/api/ai/transcribe` | Multipart audio → Deepgram → transcript + segments |
| POST | `/api/ai/generate-note` | Transcript + context → Claude → clinical note draft |
| POST | `/api/ai/suggest-codes` | Finalized note → Claude → CPT/ICD-10 suggestions |
| POST | `/api/ai/prior-auth` | Encounter note + payer rules → Claude → PA form |

### Encounters

| Method | Route | Description |
|---|---|---|
| GET | `/api/encounters` | List encounters (scoped to practice) |
| POST | `/api/encounters` | Create new encounter |
| PATCH | `/api/encounters/[id]/codes` | Accept or reject a code suggestion |
| POST | `/api/encounters/[id]/notes/[noteId]/finalize` | Finalize and sign a clinical note |

### Patients

| Method | Route | Description |
|---|---|---|
| GET | `/api/patients` | List patients |
| POST | `/api/patients` | Create new patient (encrypts PHI before write) |

### Compliance

| Method | Route | Description |
|---|---|---|
| GET | `/api/compliance` | Run HIPAA checks + fetch active alerts |

### Billing

| Method | Route | Description |
|---|---|---|
| POST | `/api/webhooks/stripe` | Stripe subscription webhook handler |

---

## 16. Role Permissions Reference

| Permission | provider | admin | biller | staff | superadmin |
|---|---|---|---|---|---|
| View own encounters | ✓ | ✓ | — | ✓ | ✓ |
| View all practice encounters | — | ✓ | ✓ | — | ✓ |
| Record audio / generate notes | ✓ | — | — | — | ✓ |
| Accept / reject codes | ✓ | — | ✓ | — | ✓ |
| Finalize notes | ✓ | — | — | — | ✓ |
| View patients | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create / edit patients | ✓ | ✓ | — | ✓ | ✓ |
| Prior auth management | ✓ | ✓ | ✓ | — | ✓ |
| Compliance dashboard | ✓ | ✓ | — | — | ✓ |
| Analytics | ✓ | ✓ | ✓ | — | ✓ |
| User management | — | ✓ | — | — | ✓ |
| Billing / subscription | — | ✓ | — | — | ✓ |
| Practice settings | — | ✓ | — | — | ✓ |

RBAC is enforced both at the API layer (`src/lib/auth/rbac.ts`) and at the page level using `requirePermission()`.

---

## 17. Local Development Setup

### Prerequisites

- Node.js 20+
- Docker Desktop (for PostgreSQL + Redis + MinIO)
- A `.env` file (copy from `.env.example` and fill in keys)

### Step-by-step

```bash
# 1. Install dependencies
npm install

# 2. Start infrastructure (PostgreSQL 16 + pgvector, Redis 7, MinIO)
docker compose up -d

# 3. Run database migrations (creates all 16 tables)
npx prisma migrate dev

# 4. Seed demo data
npm run seed
# Creates: Sunrise Behavioral Health practice
# Admin:    admin@sunrise.example / AdminPass123!
# Provider: dr.johnson@sunrise.example / ProvPass123!

# 5. (Optional) Generate knowledge base embeddings for RAG
npm run generate-embeddings

# 6. Start dev server
npm run dev
# App runs at http://localhost:3000
```

### Useful dev commands

```bash
npm run typecheck         # TypeScript strict mode check (must pass before PRs)
npm run test              # Vitest unit tests
npm run test:e2e          # Playwright E2E tests
npx prisma studio         # Browser-based DB explorer at localhost:5555
npx prisma migrate dev --name <name>  # Create a new DB migration
npm run db:studio         # Alias for prisma studio
```

### Environment variables cheat sheet

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `APP_SECRET` | 256-bit AES key for PHI encryption — **never share** |
| `NEXTAUTH_SECRET` | JWT signing key for sessions |
| `ANTHROPIC_API_KEY` | Claude API access |
| `DEEPGRAM_API_KEY` | Speech-to-text |
| `STRIPE_SECRET_KEY` | Billing API |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `AWS_S3_BUCKET` | Audio file storage |
| `REDIS_URL` | Session cache and job queue |

See `.env.example` for the full list.

### Docker services

| Service | Port | Purpose |
|---|---|---|
| postgres (pgvector/pgvector:pg16) | 5432 | Primary database + vector search |
| redis (redis:7-alpine) | 6379 | Sessions, caching, BullMQ queues |
| minio | 9000 / 9001 | S3-compatible local object storage |

---

*Last updated: February 2026. Covers Phase 1 (MVP) + Phase 2 (Compliance & Revenue Recovery).*
