# Incident Response Runbook — SpecScribe

**Version:** 1.0
**Date:** 2026-03-04
**Owner:** Privacy Officer / DevOps Lead
**Review cycle:** Annually, or after any material security incident

> Cross-references:
> - Breach notification obligations → [docs/canadian-privacy-compliance.md § 6](./canadian-privacy-compliance.md)
> - Backup/restore procedure → [docs/backup-restore-runbook.md § 4.4](./backup-restore-runbook.md)
> - Regulator contacts → Section 7 of this document

---

## 1. Severity Classification

Classify every incident immediately. Severity determines response speed and who is notified.

| Severity | Definition | Examples | Response SLA |
|----------|-----------|---------|-------------|
| **P1 — Critical** | PHI confirmed or suspected breached; system unavailable; active attack in progress | Ransomware, DB exfiltration, unauthorized PHI access confirmed, production down | Immediate — escalate within 15 min |
| **P2 — High** | Suspected breach under investigation; significant degradation; security control bypass | Failed login spike, suspicious query patterns, MFA bypass attempt, partial outage | Escalate within 1 hour |
| **P3 — Medium** | Anomaly detected, no confirmed breach; non-critical service degraded | Backup job failure, elevated error rates, unusual access pattern | Investigate within 4 hours |
| **P4 — Low** | Minor issue, no data risk, informational | Dependency vulnerability (no exploit), expired certificate warning | Resolve within 5 business days |

---

## 2. On-Call Contacts

Fill in before go-live. Keep this section updated whenever roles change.

| Role | Name | Phone | Email | When to call |
|------|------|-------|-------|-------------|
| **Privacy Officer** | Adam Robinson | [phone] | privacy@specscribe.ca | All P1/P2 incidents immediately |
| **DevOps Lead** | [name] | [phone] | [email] | All P1/P2 incidents immediately |
| **Legal Counsel** | [firm/name] | [phone] | [email] | P1 confirmed breach; any regulator contact |
| **AWS Support** | — | 1-800-xxx | console.aws.amazon.com/support | Infrastructure incidents |
| **Clerk Support** | — | — | support@clerk.com | Auth system incidents |
| **Deepgram Support** | — | — | [enterprise contact] | STT service incidents |

---

## 3. General Incident Response Procedure

Follow these steps in order for every P1 or P2 incident.

### Step 1 — Detect & Log

- Record the **exact time** of discovery (not when the incident occurred — when you found it)
- Open an incident record immediately. Use this format:

```
Incident ID   : INC-YYYY-MM-DD-001
Discovered    : [date/time + who discovered it]
Initial class : P[1/2/3/4]
Description   : [one sentence — what was observed]
Systems       : [which services affected]
Data at risk  : [PHI? which practices? estimated volume?]
```

- Save incident records in `docs/incidents/INC-YYYY-MM-DD-001.md`

### Step 2 — Notify Privacy Officer

For P1/P2: call the Privacy Officer immediately. Do not wait to investigate first.

For P3/P4: email is sufficient.

### Step 3 — Contain

Stop the bleeding before investigating root cause. Containment actions depend on incident type — see Section 4 for playbooks by incident type.

General containment principles:
- Isolate affected systems (revoke tokens, block IPs, disable accounts) before investigating
- Do **not** delete logs, audit trails, or evidence — preserve everything
- Do **not** wipe or restore systems until the Privacy Officer approves
- Take a snapshot/backup of affected systems in their current state before any changes

### Step 4 — Assess Scope

Answer these questions to determine breach notification obligation:

1. Was PHI accessed, used, or disclosed without authorization?
2. If yes — what type of PHI? (clinical notes, audio, demographics, diagnoses)
3. How many patients are potentially affected?
4. Which practices are affected?
5. Could the PHI be decrypted by the attacker? (Was `APP_SECRET` or `BACKUP_ENCRYPTION_PASSWORD` exposed?)
6. Is re-identification of any de-identified data reasonably foreseeable?

Document answers in the incident record.

### Step 5 — Notify Affected Practices

For any P1 incident where PHI may have been affected:

- Notify the practice administrator **immediately** (same business day)
- Provide: what happened, what data may be affected, what you are doing about it, what they need to do
- Do **not** speculate about scope — share only confirmed facts + worst-case estimate

Template:

> Subject: SpecScribe Security Incident Notification — [Practice Name]
>
> We are writing to inform you of a security incident affecting SpecScribe that may involve data from your practice. We discovered [brief description] on [date/time].
>
> We are currently investigating the scope. Based on what we know so far: [confirmed facts only].
>
> We will provide a full update within 24 hours. If you have questions, contact privacy@specscribe.ca immediately.

### Step 6 — Assess Breach Notification Obligation

Jointly with the practice and legal counsel, assess whether the incident meets the regulatory notification threshold:

| Framework | Threshold | Deadline | Notify |
|-----------|-----------|----------|--------|
| **PIPEDA** | "Real risk of significant harm" to individuals | As soon as reasonably possible | OPC + affected individuals |
| **HIA (Alberta)** | Unauthorized access, use, or disclosure | As soon as practicable | OIPC Alberta + affected individuals |
| **PHIPA (Ontario)** | Theft, loss, or unauthorized use/disclosure | Without unreasonable delay | IPC Ontario + affected individuals |
| **Law 25 (Quebec)** | Risk of serious injury | **72 hours** to CAI; then individuals | CAI + affected individuals |

**When in doubt, notify.** Failure to notify is a regulatory violation. Notifying when you didn't need to is not.

### Step 7 — Notify Regulators (if threshold met)

See Section 7 for regulator contacts and notification methods.

Notification must include:
- Date and time incident was discovered
- Description of what happened and what data was affected
- Estimated number of individuals affected
- Actions taken to contain the incident
- Steps taken or planned to prevent recurrence
- Contact person at SpecScribe for follow-up

### Step 8 — Notify Affected Individuals (if threshold met)

Coordinate with the practice to notify affected patients. The custodian (practice) is the legal entity responsible for patient notification under HIA/PHIPA. SpecScribe supports them in drafting the notice.

Patient notification must include:
- What happened (plain language)
- What information was involved
- What SpecScribe and the practice are doing about it
- What the individual can do to protect themselves
- Contact information for questions

### Step 9 — Remediate

- Fix the root cause (patch, configuration change, credential rotation, etc.)
- Restore from backup if data was lost or corrupted — see [backup-restore-runbook.md § 4.4](./backup-restore-runbook.md)
- Rotate any credentials that may have been exposed (see Section 5)
- Deploy fixes through normal CI/CD pipeline with security review

### Step 10 — Post-Incident Review

Within 5 business days of resolution:

1. Complete the incident record with full timeline, root cause, and remediation steps
2. Conduct a post-mortem (blameless) — what happened, why, what we're changing
3. Update controls, runbooks, or code as needed
4. File the completed incident record in `docs/incidents/`
5. Notify the practice that the incident is resolved and provide the final incident report

---

## 4. Incident Playbooks by Type

### 4.1 Ransomware / System Compromise

**Signs:** Encrypted files, ransom note, unusual process activity, inaccessible DB

**Containment:**
1. Isolate affected systems immediately — disconnect from network
2. Do NOT pay the ransom without legal counsel
3. Preserve evidence — do not wipe systems yet
4. Notify Privacy Officer + AWS Support immediately

**Recovery:**
1. Identify the most recent clean backup (before compromise date)
2. Provision a new, clean environment (do not restore onto compromised infrastructure)
3. Follow [backup-restore-runbook.md § 4.4](./backup-restore-runbook.md) — Step 3 Option A
4. Rotate ALL credentials: `APP_SECRET`, `BACKUP_ENCRYPTION_PASSWORD`, Clerk keys, Anthropic keys, DB passwords, Stripe keys
5. Run `npx prisma migrate deploy` on new environment to confirm schema integrity
6. Validate row counts match last known good state

**Breach assessment:** Assume PHI is compromised unless encryption can be confirmed intact. Notify practices and assess regulatory notification.

---

### 4.2 Unauthorized Database Access

**Signs:** Audit log anomalies, queries from unexpected IPs, unexpected data export events

**Containment:**
1. Revoke DB credentials immediately
2. Block the source IP at the network/WAF level
3. Rotate `DATABASE_URL` and redeploy application

**Investigation:**
```bash
# Check audit log for suspicious access patterns
# (run against production DB via Prisma Studio or psql)
SELECT user_id, action, resource, ip_address, created_at
FROM audit_log
WHERE created_at > NOW() - INTERVAL '48 hours'
  AND ip_address NOT IN ('[known office IPs]')
ORDER BY created_at DESC
LIMIT 100;
```

**Breach assessment:** Determine if the attacker could read encrypted PHI. Key question: was `APP_SECRET` also exposed? If not, encrypted columns are unreadable. Document this assessment.

---

### 4.3 Backup Bucket Compromised

**Signs:** Unexpected S3 access logs, Object Lock bypass attempt, unauthorized IAM activity

**Containment:**
1. Revoke the IAM credentials used by the backup job immediately
2. Enable S3 Block Public Access on the backup bucket (if not already on)
3. Review CloudTrail logs for access history

**Breach assessment:**
- Backup archives are AES-256-CBC encrypted with `BACKUP_ENCRYPTION_PASSWORD`
- If the attacker only accessed `.dump.enc` files AND `BACKUP_ENCRYPTION_PASSWORD` was not exposed, PHI is protected
- If there is any possibility `BACKUP_ENCRYPTION_PASSWORD` was obtained (e.g., from Secrets Manager), treat as a full PHI breach
- Re-encrypt all archives with a new password — see [backup-restore-runbook.md § 4.5](./backup-restore-runbook.md)

---

### 4.4 Compromised User Credentials (Provider Account)

**Signs:** Login from unexpected location, MFA bypass, unusual encounter access patterns

**Containment:**
1. Immediately disable the affected Clerk user account
2. Revoke all active sessions for that user in Clerk dashboard
3. Invalidate the `ss_mfa` cookie by resetting the user's MFA secret in the DB

```sql
UPDATE users
SET mfa_secret = NULL,
    mfa_enabled = false,
    mfa_backup_codes = NULL,
    updated_at = NOW()
WHERE id = '[user_id]'
  AND practice_id = '[practice_id]';
```

4. Review audit log for all actions taken under that user account in the past 30 days

**Breach assessment:** Check audit log for any PHI accessed during the compromised period. Notify the practice of what data may have been viewed.

---

### 4.5 Vendor Security Incident (Clerk / Deepgram / AWS)

**What should happen:** Vendor notifies SpecScribe within 24–48 hours per DPA.

**If SpecScribe discovers it before the vendor notifies:**
1. Contact the vendor's security/incident team immediately
2. Request: confirmation of scope, affected customers, timeline, and remediation steps

**Assessment:**
- **Clerk incident:** User identity data (names, emails, MFA secrets) may be exposed. No patient PHI. Notify affected providers; assess PIPEDA threshold for personal information breach.
- **Deepgram incident:** Audio/transcript data may be exposed. This is PHI — treat as P1. Notify practices immediately. Assess HIA/PIPEDA notification threshold.
- **AWS incident:** Scope depends on what services are affected. If RDS or S3 is involved, treat as P1.

---

## 5. Credential Rotation Checklist

Run this checklist after any P1 incident or suspected credential compromise.

| Credential | Where to rotate | How to redeploy |
|-----------|----------------|----------------|
| `APP_SECRET` | AWS Secrets Manager → update env var | Redeploy application; existing encrypted PHI is unreadable until rotated — coordinate carefully |
| `BACKUP_ENCRYPTION_PASSWORD` | AWS Secrets Manager | Re-encrypt all existing backup archives (see backup runbook § 4.5) |
| `DATABASE_URL` | AWS RDS → rotate password | Update env var, redeploy |
| `NEXTAUTH_SECRET` / Clerk keys | Clerk dashboard + env vars | Redeploy; all active sessions invalidated |
| `ANTHROPIC_API_KEY` / Bedrock credentials | AWS IAM | Rotate IAM role credentials |
| `STRIPE_SECRET_KEY` | Stripe dashboard | Update env var, redeploy |
| `DEEPGRAM_API_KEY` | Deepgram dashboard | Update env var, redeploy |

> **Warning on `APP_SECRET` rotation:** This key encrypts all PHI columns. Rotating it requires a migration job that decrypts all records with the old key and re-encrypts with the new key before redeployment. Do not rotate this key without a tested migration plan. Contact your DevOps lead before proceeding.

---

## 6. Evidence Preservation

Do not delete or modify any of the following during an active incident:

- CloudWatch / application logs
- Audit log table (`audit_log`) in the database
- S3 access logs on the backup bucket
- AWS CloudTrail logs
- Network flow logs
- The compromised system itself (take a snapshot before remediation)

If law enforcement or a regulator requests evidence, do not provide it without consulting legal counsel first.

---

## 7. Regulator Contacts

| Regulator | Jurisdiction | Contact | Method |
|-----------|-------------|---------|--------|
| **OPC** (Office of the Privacy Commissioner) | Federal / PIPEDA | priv.gc.ca/en/report-a-concern | Online breach report form |
| **OIPC Alberta** | HIA / PIPA (AB) | oipc.ab.ca · 403-297-2728 · 1-888-878-4044 | Written notice to Suite 2460, 801 - 6 Ave SW, Calgary AB T2P 3W2 |
| **IPC Ontario** | PHIPA (ON) | ipc.on.ca · 416-326-3333 | Written notice |
| **OIPC BC** | PIPA (BC) | oipc.bc.ca · 250-387-5629 | Written notice |
| **CAI Quebec** | Law 25 (QC) | cai.gouv.qc.ca | Online portal — **72-hour hard deadline** |

---

## 8. Incident Record Template

Copy this template to `docs/incidents/INC-YYYY-MM-DD-001.md` for every P1/P2 incident.

```markdown
# Incident Record: INC-[YYYY-MM-DD]-[seq]

## Summary
- **Severity:** P[1/2/3/4]
- **Status:** [Open / Contained / Resolved]
- **Discovered:** [date, time, by whom]
- **Occurred:** [estimated date/time of actual incident — may differ from discovery]
- **Resolved:** [date, time]

## Description
[What happened — factual, one paragraph]

## Systems Affected
- [ ] PostgreSQL database
- [ ] S3 backup bucket
- [ ] Audio/object store
- [ ] Auth (Clerk)
- [ ] AI pipeline (Bedrock)
- [ ] Application tier

## Data Affected
- PHI involved: Yes / No / Under investigation
- Estimated patients affected: [number or range]
- Practices affected: [list]
- PHI types: [clinical notes / audio / demographics / codes / etc.]
- Was data encrypted at rest: Yes / No
- Could attacker decrypt PHI: Yes / No / Unknown

## Timeline
| Time | Action |
|------|--------|
| [time] | Incident discovered by [person] |
| [time] | Privacy Officer notified |
| [time] | Containment action: [what] |
| [time] | Practice(s) notified |
| [time] | Root cause identified |
| [time] | Regulator notified (if applicable) |
| [time] | Remediation deployed |
| [time] | Incident closed |

## Root Cause
[Technical description of what caused the incident]

## Containment Actions
[List of actions taken to stop the incident]

## Remediation
[List of fixes deployed]

## Breach Notification Assessment
- Notification threshold met: Yes / No / Not determined
- Regulatory frameworks triggered: PIPEDA / HIA / PHIPA / Law 25
- Regulators notified: [list with dates]
- Individuals notified: Yes / No / [date planned]
- Notification method: [email / mail / practice-coordinated]

## Post-Incident Actions
- [ ] Post-mortem completed
- [ ] Controls updated
- [ ] Runbook updated
- [ ] Affected practices given final report

## Sign-Off
| Role | Name | Date |
|------|------|------|
| Privacy Officer | | |
| DevOps Lead | | |
```

---

*This runbook is a living document. Update it after every P1/P2 incident to reflect lessons learned. Last reviewed: 2026-03-04.*
