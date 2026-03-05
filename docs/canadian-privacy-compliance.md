# Canadian Privacy Compliance — SpecScribe Vendor & DPA Guide

**Jurisdiction:** Canada (federal + provincial)
**Applicable laws:** PIPEDA, PHIPA (ON), HIA (AB), PIPA (BC), Law 25 (QC)
**Document version:** 1.0
**Date:** 2026-03-01
**Status:** Draft — review with privacy counsel before vendor negotiations

> **Note:** HIPAA does not apply — SpecScribe is a Canadian product operating under Canadian federal
> and provincial health privacy law. The equivalent of a US HIPAA Business Associate Agreement (BAA)
> in Canada is a **Data Processing Agreement (DPA)** or **Privacy Agreement**.

---

## 1. Applicable Legal Framework

| Law | Jurisdiction | Who it covers | Regulator |
|-----|-------------|---------------|-----------|
| **PIPEDA** | Federal (all provinces unless superseded) | Private-sector organizations collecting personal information in the course of commercial activity | Office of the Privacy Commissioner (OPC) |
| **PHIPA** | Ontario | Health information custodians (HICs) and their agents | Information and Privacy Commissioner of Ontario (IPC) |
| **HIA** | Alberta | Health information custodians and affiliates | Office of the Information and Privacy Commissioner of Alberta (OIPC) |
| **PIPA** | British Columbia / Alberta | Private-sector organizations in BC; overlaps HIA in AB for non-health data | OIPC (AB) / OIPC (BC) |
| **Law 25 (Bill 64)** | Quebec | Any organization collecting personal information from Quebec residents | Commission d'accès à l'information (CAI) |

### Which law applies to SpecScribe?

SpecScribe is a technology service provider — a **"agent"** or **"service provider"** to health
information custodians (clinics, practitioners). The custodian's provincial law governs the
relationship; PIPEDA applies as a baseline for cross-provincial data transfers.

**In practice:** If your first customers are Alberta practices, **HIA** is your primary obligation.
See [`docs/alberta-oipc-pia.md`](./alberta-oipc-pia.md) for the pre-filled PIA questionnaire.

---

## 2. Key Definitions

### Custodian vs. Agent (vs. PIPEDA's Covered Entity / Business Associate)

| Canadian term | Meaning | SpecScribe's role |
|--------------|---------|-------------------|
| **Health information custodian (HIC)** | The clinic or practitioner who collects PHI from patients | Your *customer* |
| **Agent / affiliate / service provider** | An organization the custodian authorizes to collect, use, or disclose PHI on their behalf | **SpecScribe** |
| **Information manager** (HIA-specific) | Third party contracted to process PHI on behalf of a custodian | **SpecScribe** under HIA |

### "Personal Health Information" (PHI) under Canadian law

Broadly: any information about an identifiable individual that relates to their physical or mental
health, health history, health care provided, payments for health care, or eligibility for health
benefits. This includes names, DOBs, health card numbers, diagnoses, clinical notes, and audio
recordings of clinical encounters.

### Breach Notification Threshold

| Framework | Threshold | Timeline | Who to notify |
|-----------|-----------|----------|---------------|
| PIPEDA | "Real risk of significant harm" to the individual | "As soon as reasonably possible" — no hard deadline | OPC + affected individuals |
| PHIPA | "Theft, loss, or unauthorized use or disclosure" | Without unreasonable delay | IPC Ontario + individual |
| HIA | Unauthorized access, use, or disclosure | As soon as practicable | OIPC Alberta + individual |
| Law 25 (QC) | Confidentiality incident with risk of serious injury | 72 hours to CAI; then notify affected individuals | CAI + individuals |

---

## 3. Data Processing Agreement (DPA) Requirements

Every vendor that touches PHI on behalf of SpecScribe (and by extension, the custodian) must have
a signed DPA. The following clauses are mandatory under Canadian law:

### Required DPA Clauses

1. **Scope and purpose** — explicitly state what PHI the vendor processes and for what purpose only
2. **Data residency** — PHI must remain in Canada; specify the region (e.g., AWS `ca-central-1`)
3. **Permitted uses** — vendor may only use PHI to deliver the contracted service; no secondary use, analytics, or model training on customer data
4. **Security safeguards** — encryption at rest (AES-256) and in transit (TLS 1.3), access controls, audit logging
5. **Sub-processor obligations** — vendor must flow DPA obligations down to any sub-processors and provide a current list
6. **Breach notification** — vendor must notify SpecScribe of any incident within 24–48 hours; SpecScribe then notifies the custodian and regulator
7. **Data return and deletion** — upon contract termination, vendor must return or destroy all PHI within 30 days and provide written confirmation
8. **Audit rights** — SpecScribe has the right to audit or request third-party audit (SOC 2 Type II accepted as proxy)
9. **Governing law** — Canadian federal law (PIPEDA) + applicable provincial law
10. **Cross-border transfer prohibition** — vendor may not transfer PHI outside Canada without explicit written consent

### Nice-to-Have (not always achievable with large vendors)

- Annual written certification that safeguards remain in place
- Right to terminate without penalty if a breach occurs
- Indemnification for regulatory fines arising from vendor's breach

---

## 4. Vendor-by-Vendor Compliance Checklist

### 4.1 Amazon Web Services (AWS)

**What PHI it handles:** PostgreSQL database (RDS), audio files (S3), logs (CloudWatch)
**Data residency:** `ca-central-1` (Montreal) — Canadian region ✓

#### Steps to confirm DPA

1. Log in to the AWS console with the account owner credentials.
2. Navigate to **AWS Artifact** → **Agreements**.
3. Download and accept the **AWS Data Processing Addendum (DPA)** — this is a self-service click-through agreement.
4. Confirm that the services you use (RDS, S3, CloudWatch, EC2, Bedrock) are listed as **PIPEDA-eligible** in the DPA schedule.
5. Verify that your AWS account is configured to store data only in `ca-central-1` (check S3 bucket region and RDS instance region).
6. Save the executed DPA PDF to your compliance records folder, indexed by date.

#### Verification

- Open S3 console → check every bucket's region is `ca-central-1`
- Open RDS console → confirm instance region
- Open Bedrock console → confirm model invocation region is `ca-central-1`

---

### 4.2 AWS Bedrock (Claude AI)

**What PHI it handles:** Clinical transcripts, partial patient context sent to Claude for note generation and coding suggestions
**Data residency:** Processed in `ca-central-1` ✓
**Relationship:** Bedrock is an AWS service — covered under the same AWS DPA as above

#### Steps to confirm DPA

1. Complete step 4.1 above — the AWS DPA covers Bedrock.
2. Confirm in the AWS DPA schedule that **Amazon Bedrock** is listed as an in-scope service.
3. In the Bedrock console, verify **no model training on your data** is enabled (this is the default for API usage; confirm under Settings → Data privacy).
4. Review Anthropic's sub-processor status within AWS's sub-processor list (published on the AWS website).

#### Verification

- AWS Bedrock console → Settings → confirm "Use your data to improve AWS" is **off**
- Review AWS sub-processor list annually to confirm Anthropic's entry and data handling terms

---

### 4.3 Clerk (Authentication)

**What PHI it handles:** User identity data (name, email, MFA secrets) — not clinical PHI, but personal information under PIPEDA
**Data residency:** Clerk stores data in the US by default ⚠️

#### Steps to obtain DPA

1. Log in to the Clerk dashboard → navigate to **Settings → Legal**.
2. Check if a DPA is available for self-service download and acceptance.
3. If not available self-service, contact Clerk's enterprise sales team and request a DPA for Canadian customers.
4. In the DPA negotiation, request: data residency in Canada OR explicit acknowledgment that user identity data (not PHI) is exempt from residency requirements under your risk assessment.
5. Execute and save the DPA.

#### Risk assessment note

Clerk handles **user identity** (provider names, emails, MFA secrets) — not patient PHI. Under PIPEDA,
cross-border transfer of this data is permitted if you have a contractual arrangement with Clerk
and you inform users that their data may be processed in another country. This is a lower-risk
scenario than PHI leaving Canada.

**Action required regardless:** Add a disclosure to your privacy policy that user account data is
processed by Clerk and may be stored on servers outside Canada.

---

### 4.4 Deepgram (Speech-to-Text)

**What PHI it handles:** Raw audio recordings of clinical encounters (highest sensitivity — direct voice + clinical conversation)
**Data residency:** Deepgram's default infrastructure is US-based ⚠️

#### Steps to obtain DPA

1. Contact Deepgram's enterprise sales team — a DPA is not self-service.
2. Request:
   - A Canadian-law-compliant DPA
   - Confirmation that audio is processed in Canada (or written confirmation of deletion within X hours if processed in the US)
   - Zero data retention policy — audio deleted after transcription
   - No model training on your audio
3. Negotiate: specify the `nova-2-medical` model, confirm it does not use customer audio for fine-tuning.
4. If Deepgram can confirm Canadian data residency AND zero retention, execute the DPA.
5. If Canadian residency is unavailable, see alternative routes in Section 5.

#### Verification

- Request annual written confirmation from Deepgram that audio files are deleted after transcription
- Test via their API: confirm no audio retention by checking their API response for retention fields

---

### 4.5 Stripe (Billing)

**What PHI it handles:** None — billing and subscription data only (practice name, billing address, credit card via Stripe's own PCI-compliant vault)
**PHI risk:** Low — PHI must never be sent to Stripe

#### Steps to confirm agreement

1. Log in to the Stripe Dashboard → **Settings → Legal → Data Processing Agreement**.
2. Accept Stripe's DPA — available as a self-service click-through.
3. Confirm in your codebase that no PHI fields are ever included in Stripe metadata or customer objects.
4. Save the executed DPA.

---

## 5. Alternative Routes When a DPA Cannot Be Negotiated

If a vendor refuses to sign a DPA, or cannot meet data residency requirements, the following
options are available in order of preference.

---

### Option A — Replace with a Canadian-Resident Alternative (Preferred)

Eliminate the third-party relationship entirely.

| Vendor | Replacement | Effort |
|--------|------------|--------|
| **Deepgram** | Self-host OpenAI Whisper on AWS EC2 (`ca-central-1`) | Medium — Docker container, GPU or CPU inference, integrate with existing transcription route |
| **Clerk** | Self-hosted auth using existing Prisma `User` model + NextAuth or custom JWT | Medium — auth already partially built; Clerk wraps this |
| **Any LLM vendor** | Self-hosted open-source model (Mistral, LLaMA) on EC2 `ca-central-1` | High — model quality trade-off; likely not viable for clinical note generation quality |

**Whisper self-hosting guide (Deepgram replacement):**
1. Launch an EC2 instance in `ca-central-1` (g4dn.xlarge for GPU, or c5.2xlarge for CPU-only).
2. Deploy `openai/whisper` via Docker or Hugging Face Inference Endpoints (confirm HF Canada region availability).
3. Update `src/app/api/deepgram/route.ts` to POST audio to your self-hosted endpoint instead of `api.deepgram.com`.
4. No third-party DPA required — data never leaves your AWS account.

---

### Option B — PHI Minimization / De-identification Before Processing

If a vendor cannot meet residency requirements but you still want to use them, strip all
identifiers before the data leaves Canada.

**De-identification standards:**
- **PHIPA s.47** — Ontario: removal of 42 direct and indirect identifiers (similar to PIPEDA Safe Harbor)
- **HIA s.69** — Alberta: prescribed de-identification methods; custodian must be satisfied re-identification is not reasonably foreseeable

**Implementation approach:**
1. Before sending transcript to a non-Canadian vendor, run a de-identification step:
   - Remove: patient name, DOB, health card number, address, phone, MRN, provider name
   - Replace with tokens: `[PATIENT]`, `[PROVIDER]`, `[DOB]`, etc.
2. Send de-identified text to the vendor for processing.
3. Receive the processed output and re-associate tokens with real values locally.
4. Document the de-identification method and residual re-identification risk in your Privacy Impact Assessment.

**Residual risk:** Fully de-identified data is no longer PHI under Canadian law, but courts and
regulators look at whether re-identification is "reasonably foreseeable." Clinical narrative text
can be re-identifying even without explicit identifiers. Document your risk assessment.

---

### Option C — Explicit Informed Patient Consent

Under PIPEDA and provincial health acts, cross-border PHI transfer is permitted if the
**patient gives explicit, informed consent**.

**Requirements:**
- Plain-language consent form explaining: who the vendor is, what country data is sent to, what it is used for, patient's right to withdraw consent
- Consent must be obtained **before** the encounter is processed
- Consent record must be stored with audit trail (date, method, patient identifier)
- Patient can withdraw at any time — system must support excluding that patient's data from vendor processing

**Limitations:** This is not viable for routine operations at scale. Reserve for edge cases (e.g., a specific patient requests a service that requires cross-border processing).

---

### Option D — On-Premises / Self-Hosted Infrastructure

For maximum control with no third-party data exposure.

**Applicable to:**
- Speech-to-text: Whisper self-hosted (see Option A)
- LLM inference: self-hosted open-source model (quality trade-off)
- Auth: self-hosted (existing Prisma User model already has all required fields)

**When to consider this:** If your customer contracts require it (e.g., a large hospital system with strict data governance), or if you cannot obtain satisfactory DPAs from any vendor in a given category.

---

## 6. Breach Notification Obligations

### Incident Response Chain

```
Vendor detects incident
    → Vendor notifies SpecScribe (within 24–48 hours per DPA)
        → SpecScribe notifies the Custodian (clinic/practice) immediately
            → Custodian + SpecScribe jointly assess: does incident meet notification threshold?
                → If yes: notify regulator (OPC / provincial commissioner) + affected individuals
```

### What to Document in Every Incident Record

- Date and time incident was discovered
- Description of what data was affected (type, volume, identifiability)
- Root cause
- Containment actions taken and timeline
- Risk assessment: nature of harm, likelihood, severity
- Notification actions: who was notified, when, by what method
- Remediation steps and future prevention measures

### Regulators to Notify (by province)

| Province | Regulator | Notification method |
|----------|-----------|---------------------|
| Federal / all | OPC — [priv.gc.ca](https://priv.gc.ca) | Online breach report form |
| Ontario | IPC — [ipc.on.ca](https://ipc.on.ca) | Written notice |
| Alberta | OIPC — [oipc.ab.ca](https://oipc.ab.ca) | Written notice (HIA s.60.1) |
| BC | OIPC BC — [oipc.bc.ca](https://oipc.bc.ca) | Written notice |
| Quebec | CAI — [cai.gouv.qc.ca](https://cai.gouv.qc.ca) | Online portal (72-hr deadline) |

---

## 7. Ongoing Obligations

### Annual Vendor Review Checklist

- [ ] Confirm each DPA is still in force (not expired or superseded)
- [ ] Request updated sub-processor lists from AWS and Clerk
- [ ] Verify data residency settings have not changed (S3 bucket regions, RDS region, Bedrock region)
- [ ] Review vendor SOC 2 Type II reports (request via vendor portal or sales contact)
- [ ] Confirm "no model training on customer data" policy is still in effect for Bedrock/Deepgram

### Privacy Impact Assessment (PIA)

- **Alberta (HIA):** A PIA is required before going live with any new system that collects, uses, or discloses PHI. See [`docs/alberta-oipc-pia.md`](./alberta-oipc-pia.md) for the pre-filled questionnaire.
- **Ontario (PHIPA):** Recommended but not always mandatory; IPC strongly encourages PIAs for new health IT systems.
- **Federal (PIPEDA):** No mandatory PIA, but documenting one demonstrates accountability principle compliance.

### Data Retention

- Health records: **minimum 10 years** from last patient contact (align with longest provincial requirement)
- Audit logs: **7 years** minimum
- Audio recordings: delete after transcript is confirmed and note is finalized (minimize retention of raw audio)
- Implement soft deletes (`deletedAt` timestamp) — never hard delete PHI records within the retention period

### Staff Training Documentation

Under PIPEDA's accountability principle and PHIPA, you must demonstrate that staff with access to
PHI have received privacy training. Keep records of:
- Training content and date
- Staff members trained (by role, not name, in logs)
- Acknowledgment sign-off

---

## 8. Summary Compliance Checklist

### Before Going Live

- [ ] AWS DPA accepted via AWS Artifact (covers RDS, S3, Bedrock)
- [ ] Stripe DPA accepted
- [ ] Clerk DPA executed (or risk-assessed and disclosed in privacy policy)
- [ ] Deepgram DPA executed OR replaced with self-hosted Whisper
- [ ] All data confirmed to reside in `ca-central-1`
- [ ] Alberta OIPC PIA submitted (see [`docs/alberta-oipc-pia.md`](./alberta-oipc-pia.md))
- [ ] Privacy policy reviewed by Canadian privacy counsel
- [ ] Breach response plan documented
- [ ] Staff privacy training completed and recorded

### Ongoing

- [ ] Annual vendor DPA review (calendar reminder — set for same month each year)
- [ ] Annual sub-processor list review
- [ ] Annual SOC 2 report review for AWS and any other vendors
- [ ] Data retention policy enforced (audit quarterly)
- [ ] PIA updated if material system changes are made

---

*This document is for internal planning purposes. It does not constitute legal advice. Review with
qualified Canadian privacy counsel before executing vendor agreements or submitting regulatory
filings.*
