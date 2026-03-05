# Alberta OIPC Privacy Impact Assessment (PIA)
## Pre-Filled Questionnaire — SpecScribe

**Prepared under:** Health Information Act (HIA), RSA 2000, c H-5
**Relevant regulation:** Health Information Regulation, AR 70/2001
**Submitted to:** Office of the Information and Privacy Commissioner of Alberta (OIPC)
**Document version:** 1.0
**Date prepared:** 2026-02-25
**Status:** Draft — requires legal review before submission

---

## PART A: ORGANIZATION INFORMATION

**A1. Name of health information custodian (HIC):**
> [Practice legal name — e.g., Sunrise Behavioral Health Ltd.]

**A2. Address of HIC:**
> [Practice street address, city, province, postal code]

**A3. Primary contact for this PIA:**
> Name: [Practice Administrator name]
> Title: Practice Administrator
> Phone: [Phone]
> Email: [Email]

**A4. Name and role of person completing this PIA:**
> Name: Adam Robinson
> Title: System Administrator / Platform Owner
> Organization: SpecScribe (technology service provider to the HIC)

**A5. Is your organization a health information custodian as defined under the HIA?**
> **Yes.** Medical practices using SpecScribe are health information custodians under s. 1(1)(j) of the HIA as they collect, use, and disclose individually identifying health information in the course of providing health services.
> SpecScribe (Antigravity Labs Inc.) acts as an **affiliate** of the HIC under s. 1(1)(a) of the HIA — a service provider authorized to handle health information on behalf of the custodian pursuant to a written agreement.

---

## PART B: DESCRIPTION OF THE INITIATIVE

**B1. Provide a brief description of the initiative, program, or activity.**
> SpecScribe is a cloud-based clinical documentation and compliance platform for specialty medical practices. It provides:
> - AI-assisted clinical note generation from audio recordings of provider-patient encounters
> - Automated medical coding suggestions (CPT, ICD-10)
> - Prior authorization automation
> - PIPEDA/HIA compliance monitoring
> - Billing and denial prevention analytics
>
> The platform processes audio recordings of clinical encounters, transcribes them using a speech-to-text API (Deepgram), and uses an AI language model (Anthropic Claude) to generate draft clinical notes. Providers review and approve all AI-generated content before finalization. No information is auto-submitted or finalized without explicit provider approval.

**B2. What is the purpose of the collection, use, or disclosure of health information?**
> - To assist regulated health professionals in creating accurate, complete clinical documentation
> - To suggest appropriate diagnostic and procedure codes to reduce claim denials
> - To automate prior authorization requests to payers
> - To monitor documentation completeness and compliance with applicable standards
> - To reduce administrative burden on clinicians, thereby improving time available for patient care

**B3. What is the legal authority for the collection of health information?**
> - **s. 27(1) HIA** — A custodian may collect health information for the purpose of providing health services
> - **s. 35(1)(a) HIA** — A custodian may use health information for the purpose for which it was collected
> - **s. 37 HIA** — Disclosure to affiliates acting under a written agreement
> Patient consent is obtained at the point of care in accordance with standard practice consent processes. Audio recording of clinical encounters requires explicit informed consent from all parties.

**B4. Is this a new initiative, or a modification of an existing one?**
> New initiative — SpecScribe is a new technology platform being introduced to replace or supplement manual clinical documentation and coding workflows.

**B5. When is the initiative expected to launch?**
> Phased rollout beginning Q2 2026.

---

## PART C: HEALTH INFORMATION INVOLVED

**C1. What categories of health information will be collected?**

| Category | Examples | Collected? |
|---|---|---|
| Patient identity | Name, date of birth, health card number, MRN | Yes |
| Contact information | Phone, email, address | Yes |
| Demographic information | Gender, language | Yes |
| Clinical notes | Progress notes, assessments, treatment plans | Yes |
| Audio recordings | Recording of provider-patient encounter | Yes (temporary) |
| Transcripts | Text transcription of encounter audio | Yes |
| Diagnostic codes | ICD-10 diagnosis codes | Yes |
| Procedure codes | CPT procedure codes | Yes |
| Insurance / billing | Payer name, policy number, claim status | Yes |
| Medication information | Referenced within clinical notes | Incidental |
| Mental health information | Behavioral health notes, diagnoses | Yes (specialty focus) |

**C2. Is any of this information particularly sensitive?**
> **Yes.** The platform's initial vertical is **behavioral health**, which involves mental health diagnoses, psychotherapy notes, substance use history, and psychiatric treatment records. This is among the most sensitive categories of health information under Alberta law and warrants heightened safeguards.

**C3. From whom is the health information collected?**
> - Directly from patients (intake forms, demographic data)
> - From regulated health professionals during clinical encounters (audio recordings, provider-entered notes)
> - From existing EHR/EMR systems via FHIR R4 API integration (prior clinical history, medications, demographics)

**C4. How much health information will be processed?**
> Volume depends on subscribing practice size (3–30 providers per practice). Each provider may document 15–30 encounters per day. At full capacity per practice, this represents approximately 300–900 encounter records per day per practice location.

---

## PART D: HOW INFORMATION IS USED

**D1. Describe how health information flows through the system.**

```
1. Patient attends clinical encounter with provider
2. Provider initiates recording in SpecScribe (with patient consent)
3. Audio streamed to Deepgram (speech-to-text) → transcript returned
4. Transcript + patient context sent to Anthropic Claude API → draft note generated
5. Provider reviews, edits, and approves note in SpecScribe interface
6. Approved note triggers AI coding suggestion (CPT/ICD-10)
7. Provider reviews and accepts/modifies codes
8. Finalized note + codes optionally pushed back to EHR via FHIR
9. Billing and compliance workflows triggered based on finalized data
```

**D2. Is health information used to make decisions directly affecting individuals?**
> **No.** SpecScribe generates **draft** outputs only. All clinical decisions — including note content, diagnoses, and procedure codes — are reviewed and approved by a regulated health professional before finalization. The system is a documentation tool, not a clinical decision-making system.

**D3. Is health information matched or linked across systems?**
> Health information may be linked between SpecScribe and the practice's EHR system via FHIR R4 API for the purpose of pre-populating patient context (demographics, prior notes, medications). This linkage is limited to data necessary for documentation and is performed under the custodian's direction.

---

## PART E: DISCLOSURE OF HEALTH INFORMATION

**E1. To whom is health information disclosed outside the HIC?**

| Recipient | Purpose | Legal Basis | Location |
|---|---|---|---|
| Anthropic (Claude API) | AI note generation from de-identified transcripts | Affiliate agreement — s. 37 HIA | USA (zero data retention agreement) |
| Deepgram | Speech-to-text transcription | Affiliate agreement — s. 37 HIA | USA (DPA (Data Processing Agreement) in place) |
| Amazon Web Services | Cloud hosting, encrypted storage | Affiliate agreement — s. 37 HIA | Canada (ca-central-1 region preferred) |
| Stripe | Billing/subscription management — **no PHI transmitted** | N/A — billing data only | USA |
| Insurance payers | Prior authorization requests (provider-initiated) | s. 37 or patient consent | Varies |

**E2. Is health information transferred or accessed outside Canada?**
> **Yes** — AI processing (Anthropic Claude API) and speech-to-text (Deepgram) are US-based services. The following safeguards are in place:
> - **Data minimization**: Patient name, date of birth, health card number, and address are stripped before sending content to AI APIs. Only clinical text necessary for note generation is transmitted.
> - **Zero data retention**: Anthropic API is configured with zero data retention — prompts and outputs are not stored or used for model training.
> - **Contractual protections**: Data Processing Agreements (DPAs) are in place with all sub-processors and vendors.
> - **Encryption in transit**: All data transmitted via TLS 1.3.
>
> Patients are informed of cross-border data flows in the practice's privacy notice and consent documentation.

**E3. Are there any secondary uses of health information?**
> Health information is used solely for the purposes described in Part B. It is not sold, shared with third parties for marketing purposes, or used for any purpose beyond supporting the clinical documentation workflow of the subscribing practice.

---

## PART F: DATA RETENTION AND DESTRUCTION

**F1. How long is health information retained?**

| Data Type | Retention Period | Rationale |
|---|---|---|
| Clinical notes / finalized records | 10 years from last entry | Exceeds Alberta HIA s. 35(2) minimum; covers all Canadian provincial jurisdictions |
| Audio recordings | 30 days post-transcription, then destroyed | Temporary processing artifact; not a legal medical record |
| Transcripts | 10 years (part of encounter record) | Required for audit and clinical continuity |
| Audit logs | 10 years | PIPEDA + HIA compliance requirement |
| Billing records | 7 years | CRA / provincial billing requirements |

**F2. How is health information securely destroyed when no longer needed?**
> - Database records: Cryptographic erasure (encryption key destruction) followed by soft-delete flagging (`deleted_at` timestamp). Hard deletion after retention period.
> - Audio files (S3): AWS S3 Object Lifecycle policy triggers secure deletion after 30 days.
> - Backups: Encrypted backup tapes/snapshots destroyed per schedule using NIST 800-88 guidelines.
> - Hard delete is never performed on PHI within the retention window.

---

## PART G: SECURITY SAFEGUARDS

**G1. Describe the administrative safeguards in place.**
> - All staff with access to health information complete PIPEDA/HIA privacy training annually
> - Role-based access control (RBAC): providers access only their own patients; admins manage practice-level settings; no role has unrestricted cross-practice access
> - Privacy and security policies documented and reviewed annually
> - Incident response plan in place with 72-hour breach notification procedures
> - Business Associate Agreements / affiliate agreements signed with all third-party vendors
> - Annual third-party penetration testing required before any PHI enters production

**G2. Describe the technical safeguards in place.**
> - **Encryption at rest**: AES-256-GCM applied at the application layer before database write; separate encryption of S3-stored audio files using AWS SSE-KMS
> - **Encryption in transit**: TLS 1.3 enforced on all connections; HSTS headers applied
> - **Authentication**: Multi-factor authentication (TOTP) mandatory for all user accounts; 15-minute idle session timeout; 24-hour absolute session maximum
> - **Audit logging**: Every read, write, update, and delete of health information is logged with user ID, timestamp, IP address, and resource identifier — PHI values are never logged
> - **Multi-tenant isolation**: Every database query is scoped by `practice_id` derived from the authenticated session JWT — cross-practice data access is architecturally prevented
> - **Vulnerability management**: Critical patches applied within 15 days; dependency scanning automated via CI/CD pipeline
> - **Account lockout**: 5 failed login attempts triggers a 30-minute account lockout

**G3. Describe the physical safeguards in place.**
> - Platform hosted on AWS (PIPEDA-eligible infrastructure); no on-premises servers
> - AWS data centres maintain SOC 2 Type II, ISO 27001, and PIPEDA compliance
> - Canadian data residency (ca-central-1) targeted for primary storage; cross-border transfers limited to AI processing as described in Part E
> - Staff access to production infrastructure requires VPN + MFA; no direct public database endpoints

---

## PART H: ACCESS AND CORRECTION

**H1. How can individuals access their own health information held in the system?**
> Patients do not directly access SpecScribe. Access requests are handled by the health information custodian (the medical practice) in accordance with HIA Part 3. The practice can export complete patient records from SpecScribe in PDF or FHIR format upon request.

**H2. How can individuals request correction of their health information?**
> Correction requests are directed to the custodian (the practice). The custodian can update records in SpecScribe. The system maintains an audit trail of all corrections, including who made the change and when.

**H3. How are complaints about privacy handled?**
> Complaints are directed to the practice's Privacy Officer. If unresolved, individuals may file a complaint with the OIPC at:
> Office of the Information and Privacy Commissioner of Alberta
> Suite 2460, 801 - 6 Ave SW
> Calgary, Alberta T2P 3W2
> Tel: 403-297-2728 | Toll-free: 1-888-878-4044
> www.oipc.ab.ca

---

## PART I: PRIVACY RISK ASSESSMENT

**I1. Identify privacy risks and mitigations.**

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Unauthorized access to patient records | Low | Critical | MFA, RBAC, session timeouts, audit logging |
| Cross-border data transfer (AI APIs) | Certain | Medium | Data minimization, zero-retention agreement, DPA, TLS 1.3 |
| Data breach / ransomware | Low | Critical | Encryption at rest + in transit, immutable backups, incident response plan |
| Insider threat (staff misuse) | Low | High | RBAC least-privilege, audit logs, access reviews |
| AI hallucination affecting clinical decisions | Medium | High | All AI output is draft only; mandatory provider review before finalization |
| Audio recording without patient consent | Low | High | Consent workflow built into encounter start flow; recording cannot begin without consent acknowledgement |
| Re-identification from de-identified data sent to AI | Very Low | High | Strict field stripping before AI transmission; no name/DOB/HCN sent to external APIs |
| Unauthorized secondary use by vendor | Low | Critical | Contractual prohibition in DPA; zero-retention API configuration |
| Loss of availability (system downtime) | Low | Medium | Multi-AZ deployment, automated failover, 72-hour RTO target |

**I2. Residual risks after mitigation:**
> The primary residual risk is the cross-border transfer of clinical text to US-based AI providers. While data minimization and contractual safeguards significantly reduce this risk, patients in Alberta should be clearly informed of this in the practice consent form. Ongoing monitoring of vendor compliance is required.

**I3. Overall privacy risk rating:**
> **Medium** — The platform handles highly sensitive behavioral health information and involves cross-border AI processing. However, strong technical and administrative controls, combined with mandatory provider review of all AI outputs, reduce the risk to an acceptable level. Residual risk is manageable with the mitigations described above.

---

## PART J: DECLARATION AND SIGN-OFF

**J1. Attestation**

I attest that the information provided in this Privacy Impact Assessment is accurate and complete to the best of my knowledge. I commit to implementing the privacy safeguards described herein and to notifying the OIPC of any material changes to this initiative.

| Role | Name | Signature | Date |
|---|---|---|---|
| Health Information Custodian (Practice Owner / Medical Director) | | | |
| Privacy Officer | | | |
| System Administrator (SpecScribe) | Adam Robinson | | 2026-02-25 |

---

## APPENDIX A: RELEVANT LEGISLATION

- Health Information Act (HIA), RSA 2000, c H-5
- Health Information Regulation, AR 70/2001
- Personal Information Protection Act (PIPA), SA 2003, c P-6.5
- Freedom of Information and Protection of Privacy Act (FOIP), RSA 2000, c F-25

## APPENDIX B: VENDOR AGREEMENTS REQUIRED BEFORE GO-LIVE

- [ ] Anthropic — Data Processing Agreement (zero retention) + DPA (Data Processing Agreement)
- [ ] Deepgram — DPA (Data Processing Agreement)
- [ ] Amazon Web Services — DPA (Data Processing Agreement) (use AWS PIPEDA-eligible services only)
- [ ] Stripe — Data Processing Agreement (confirm no PHI transmitted)
- [ ] Practice — Affiliate Agreement with SpecScribe under s. 37 HIA

## APPENDIX C: RELATED DOCUMENTS

- SpecScribe Security Risk Assessment (separate document)
- Incident Response Plan
- Patient Consent for Audio Recording (template)
- Privacy Notice / Information Practices statement
- Staff Privacy Training records
