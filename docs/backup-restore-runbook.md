# Backup & Restore Runbook — SpecScribe

**Version:** 1.0
**Date:** 2026-03-03
**Owner:** DevOps Lead / Privacy Officer
**Review cycle:** Annually, or after any material infrastructure change

---

## 4.1 Overview

### What is backed up and why

| Data tier | Backup method | Reason |
|-----------|--------------|--------|
| **PostgreSQL database** | `pg_dump --format=custom`, encrypted, uploaded to backup S3 bucket | Contains all PHI (patients, encounters, clinical notes, audit logs, compliance records). This is the critical tier. |
| **MinIO / S3 object store** | `aws s3 sync` mirror to backup S3 bucket | Contains audio recordings of clinical encounters and uploaded patient documents. These are PHI under HIA / PIPEDA. |
| **Redis** | **Not backed up** — intentionally excluded | Redis holds session state only. If Redis is lost, all active sessions expire and users must re-authenticate. This is an acceptable operational impact with no data loss. |
| **Application tier** | **Not backed up** — stateless | The Next.js application is deployed from source code (Vercel / AWS ECS). Re-deploy from the last release tag if the compute layer fails. |

### RTO and RPO targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| **RTO** (Recovery Time Objective) | **72 hours** | Benchmark adopted from PIPEDA / HIA expectations for health information systems. A practice must be able to resume clinical documentation within 72 hours of a declared disaster. |
| **RPO** (Recovery Point Objective) | **24 hours** | Daily automated backups at 02:00 UTC. Maximum data loss in a full-loss scenario is one day of encounters. |

### Backup encryption

All PostgreSQL dump archives are encrypted with **AES-256-CBC + PBKDF2 (100 000 iterations)** using the `BACKUP_ENCRYPTION_PASSWORD` environment variable before they leave the application server.

- `BACKUP_ENCRYPTION_PASSWORD` is stored in **AWS Secrets Manager** — not in `.env` files, source code, or CI environment variables.
- `BACKUP_ENCRYPTION_PASSWORD` is **separate from `APP_SECRET`** (which is the PHI column encryption key). Mixing them creates a single point of compromise.
- The object-store mirror relies on **bucket-level SSE-S3 or SSE-KMS** on the destination bucket.

### Retention policy

| Archive type | Minimum retention | Enforcement |
|-------------|------------------|-------------|
| PostgreSQL dump archives | **90 days** | S3 Object Lock (Governance mode) + Lifecycle rule deleting after 90 days |
| Object store mirror | **90 days** | S3 Object Lock on destination bucket |
| Live database records | **10 years** from last patient contact | Soft-delete enforced in application layer (`deletedAt` column) |
| Audit logs | **7 years** minimum | Never hard-deleted; retained in `audit_log` table |

> The 10-year legal retention obligation (HIA, PHIPA) applies to the **live database records**, not to backup archives. Backup archives exist solely for disaster recovery and need only be kept for 90 days.

---

## 4.2 Backup Schedule

### Daily automated backup

```
Schedule : 02:00 UTC daily
Command  : /app/scripts/backup.sh >> /var/log/specscribe-backup.log 2>&1
Cron     : 0 2 * * * /app/scripts/backup.sh >> /var/log/specscribe-backup.log 2>&1
```

In production on AWS, prefer **EventBridge Scheduler** over cron to get CloudWatch metrics and alerting on job failure.

### Verify the latest backup exists

```bash
aws s3 ls s3://$BACKUP_DEST_S3_BUCKET/$BACKUP_DEST_S3_PREFIX/db/ \
  --recursive \
  --region ca-central-1 \
| sort \
| tail -5
```

Each line shows a file like:
```
2026-03-03 02:04:17   8945231 backups/specscribe/db/specscribe_db_20260303_020000.dump.enc
```

If no file from the expected date appears, the backup job failed — check the CloudWatch alarm (see Section 4.6).

### Cross-region replication (manual setup — one-time)

S3 cross-region replication copies every object written to the backup bucket to a second bucket in a different Canadian region.

1. Open **AWS S3 Console → backup bucket → Management → Replication rules**.
2. Click **Create replication rule**.
3. Source: all objects in the bucket.
4. Destination: a second bucket in **ca-west-1** (Calgary) — create this bucket first with identical versioning and Object Lock settings.
5. IAM role: allow S3 to read from source and write to destination — AWS creates this automatically.
6. Enable **Replication Time Control (RTC)** for guaranteed 15-minute replication SLA.
7. Save the rule.

After setup, every new backup object is automatically replicated within 15 minutes.

---

## 4.3 Quarterly Restore Test

HIA and PIPEDA's accountability principle require that backup and restore procedures be **tested**, not just documented. The quarterly restore test is mandatory before go-live and every quarter thereafter.

### Procedure

1. Ensure the local Docker environment is running:
   ```bash
   docker compose up -d postgres
   docker compose ps postgres  # confirm "healthy"
   ```
2. Run the automated verification script:
   ```bash
   DATABASE_URL="postgresql://specscribe:localdevonly@localhost:5432/specscribe_dev" \
   BACKUP_ENCRYPTION_PASSWORD="$(aws secretsmanager get-secret-value \
     --secret-id specscribe/backup-encryption-password \
     --query SecretString \
     --output text)" \
   bash scripts/verify-restore.sh
   ```
3. Review the output. Confirm all row counts match and the script exits 0.
4. Record the result in [docs/restore-test-log.md](./restore-test-log.md).

### Who is responsible

| Role | Responsibility |
|------|---------------|
| **DevOps Lead** | Schedule and execute the test; maintain the CI workflow |
| **Privacy Officer** | Sign off the test log entry; escalate failures |
| **Practice Admin** (customer) | Notified of test completion as part of annual PIPEDA accountability report |

### Where to log results

[docs/restore-test-log.md](./restore-test-log.md) — add one row per test. **The first completed restore test must be logged before go-live.**

---

## 4.4 Incident Restore Procedure

Follow these steps in order. Do not skip steps under time pressure — each step prevents a worse outcome.

### Step 1 — Declare the incident

- Notify the **Privacy Officer** immediately.
- Open an incident record (Jira, PagerDuty, or equivalent). Log the time of discovery.
- If patient data may have been accessed without authorization, treat as a potential breach — see Section 4.5.

### Step 2 — Identify the most recent valid backup

```bash
aws s3 ls s3://$BACKUP_DEST_S3_BUCKET/$BACKUP_DEST_S3_PREFIX/db/ \
  --recursive \
  --region ca-central-1 \
| sort \
| tail -10
```

Choose the newest file that predates the incident. Record the S3 URI, e.g.:
```
s3://specscribe-backups/backups/specscribe/db/specscribe_db_20260303_020000.dump.enc
```

### Step 3 — Provision the restore target

**Option A — RDS (production restore):**
1. Launch a new RDS PostgreSQL 16 instance in `ca-central-1`.
2. Use the same parameter group as production (pgvector extension enabled).
3. Note the endpoint, port, username, and password.

**Option B — Local Docker (staging / test restore):**
```bash
docker compose up -d postgres
# uses default credentials from docker-compose.yml
```

### Step 4 — Run the restore script

Retrieve the encryption password from Secrets Manager, then restore:

```bash
export BACKUP_ENCRYPTION_PASSWORD="$(aws secretsmanager get-secret-value \
  --secret-id specscribe/backup-encryption-password \
  --query SecretString \
  --output text)"

bash scripts/restore.sh \
  --db-backup "s3://specscribe-backups/backups/specscribe/db/specscribe_db_YYYYMMDD_HHMMSS.dump.enc" \
  --target-db "postgresql://user:password@restore-host:5432/specscribe_prod" \
  --i-know-what-i-am-doing
```

> **Note:** `--i-know-what-i-am-doing` is required when the target database name contains "prod". Remove this flag if restoring to a non-production target.

The script will print row counts for `practices`, `users`, `patients`, `encounters`, and `audit_log`.

### Step 5 — Verify row counts

The restore script prints row counts automatically. Cross-check:
- `practices` ≥ 1
- `users` ≥ 1
- `patients` count is plausible (compare against last known count from monitoring)
- `audit_log` count is plausible

If counts are zero or implausible, stop — do not redirect production traffic. Investigate the restore before proceeding.

### Step 6 — Validate schema

Run a Prisma schema pull against the restored database to confirm the schema matches the current application version:

```bash
DATABASE_URL="postgresql://user:password@restore-host:5432/specscribe_prod" \
npx prisma db pull
```

This command should complete with no schema drift warnings. If it reports differences, the backup may be from a different schema version — check the migration history.

### Step 7 — Redirect application traffic

Update the `DATABASE_URL` environment variable in your deployment platform (Vercel, ECS task definition, etc.) to point to the restored database, then redeploy or restart the application.

Perform a smoke test:
- Sign in as a provider
- Confirm today's encounters are visible (or note that encounters since the backup are lost — communicate this to affected providers)
- Confirm the compliance dashboard loads

### Step 8 — Check the health endpoint

```bash
curl https://app.specscribe.ca/api/health
# Expected: { "status": "ok" }
```

> **Note:** `/api/health` does not exist yet as of 2026-03-03. Add it before go-live. It should check DB connectivity and return 200 OK.

### Step 9 — Document and close

1. Add a row to [docs/restore-test-log.md](./restore-test-log.md) — date, tester, backup date used, row counts, pass/fail.
2. File an incident report covering: root cause, timeline, data loss assessment, remediation steps, and whether breach notification is required (see Section 4.5).
3. Notify affected providers of the outage window and any data loss (encounters created after the backup date).

---

## 4.5 Breach Notification Triggers

Cross-reference [docs/canadian-privacy-compliance.md](./canadian-privacy-compliance.md) Section 6 for the full incident response chain.

### Scenario: backup bucket compromised (unauthorized access)

If there is evidence that an attacker accessed the backup bucket contents:

1. Treat as a **PHI breach** even if the files are encrypted — the encryption password may also be compromised.
2. Assess whether the attacker could have obtained `BACKUP_ENCRYPTION_PASSWORD` from Secrets Manager or any other source.
3. If decryption is plausible: notify **OIPC Alberta** (HIA s.60.1) "as soon as practicable" and notify affected individuals. Notify OPC under PIPEDA if "real risk of significant harm."
4. Rotate `BACKUP_ENCRYPTION_PASSWORD` immediately (see below).

### Rotating BACKUP_ENCRYPTION_PASSWORD

When the encryption password is suspected or confirmed compromised, all existing backup archives must be re-encrypted with the new password. **Existing `.dump.enc` files encrypted with the old password cannot be restored without the old password.**

Procedure:

```bash
# 1. Download each existing backup archive
aws s3 cp s3://$BACKUP_DEST_S3_BUCKET/$BACKUP_DEST_S3_PREFIX/db/<file>.dump.enc /tmp/old.dump.enc

# 2. Decrypt with the OLD password
OLD_PASSWORD="<old password — retrieved from Secrets Manager version history>"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
  -in /tmp/old.dump.enc -out /tmp/old.dump \
  -pass pass:"$OLD_PASSWORD"

# 3. Re-encrypt with the NEW password
NEW_PASSWORD="<new password>"
openssl enc -aes-256-cbc -pbkdf2 -iter 100000 \
  -in /tmp/old.dump -out /tmp/new.dump.enc \
  -pass pass:"$NEW_PASSWORD"

# 4. Upload the re-encrypted file (overwrite in place or use a new key)
aws s3 cp /tmp/new.dump.enc s3://$BACKUP_DEST_S3_BUCKET/$BACKUP_DEST_S3_PREFIX/db/<file>.dump.enc

# 5. Delete temp files immediately
rm -f /tmp/old.dump.enc /tmp/old.dump /tmp/new.dump.enc
```

Repeat for every archive in the backup bucket. After rotation, update the secret in AWS Secrets Manager and redeploy any services that reference it.

### Notification timelines (by regulator)

| Framework | Threshold | Timeline | Notify |
|-----------|-----------|----------|--------|
| PIPEDA | Real risk of significant harm | As soon as reasonably possible | OPC + affected individuals |
| HIA (Alberta) | Unauthorized access, use, or disclosure | As soon as practicable | OIPC Alberta + individual |
| PHIPA (Ontario) | Theft, loss, or unauthorized use | Without unreasonable delay | IPC Ontario + individual |
| Law 25 (Quebec) | Risk of serious injury | 72 hours | CAI + individuals |

---

## 4.6 Required Infrastructure (Manual Setup Checklist)

These items cannot be automated in code — they require one-time manual configuration in the AWS console or CLI. Complete all items before enabling the daily backup cron in production.

- [ ] **Backup S3 bucket created** in `ca-central-1`
  - Bucket name: `specscribe-backups` (or your chosen name → set as `BACKUP_DEST_S3_BUCKET`)
  - Versioning: **enabled**
  - S3 Object Lock: **enabled**, mode **Governance**, default retention **90 days**
  - SSE-S3 or SSE-KMS encryption: **enabled** (covers object-store mirror files)
  - All public access: **blocked**
  - Bucket policy: deny `s3:DeleteObject` and `s3:PutBucketPolicy` except to backup IAM role

- [ ] **S3 bucket policy — deny public access confirmed**
  ```json
  { "Effect": "Deny", "Principal": "*", "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::specscribe-backups/*",
    "Condition": { "Bool": { "aws:SecureTransport": "false" } } }
  ```

- [ ] **Cross-region replication configured** (see Section 4.2)
  - Destination bucket in `ca-west-1` with identical versioning + Object Lock settings

- [ ] **`BACKUP_ENCRYPTION_PASSWORD` stored in AWS Secrets Manager**
  - Secret name: `specscribe/backup-encryption-password`
  - Value: cryptographically random 32+ character passphrase (`openssl rand -base64 32`)
  - **Not stored in `.env` files, source code, or CI secrets**
  - Rotation policy: annually (or immediately on suspected compromise)

- [ ] **IAM role for backup job** (least privilege)
  - Allow: `s3:PutObject`, `s3:GetObject` on `arn:aws:s3:::specscribe-backups/*`
  - Allow: `s3:ListBucket` on `arn:aws:s3:::specscribe-backups`
  - Allow: `s3:GetObject`, `s3:ListBucket` on source app bucket (for object-store mirror)
  - Allow: `secretsmanager:GetSecretValue` on `specscribe/backup-encryption-password`
  - Deny: all other actions

- [ ] **CloudWatch alarm on backup job failure**
  - Metric filter on `/var/log/specscribe-backup.log` or EventBridge rule
  - Alert condition: backup script exits non-zero, or no new object in backup bucket after 26:00 UTC
  - Action: SNS → PagerDuty on-call rotation

- [ ] **Daily schedule configured**
  - Cron: `0 2 * * * /app/scripts/backup.sh >> /var/log/specscribe-backup.log 2>&1`
  - Or: AWS EventBridge Scheduler rule targeting the backup ECS task at `cron(0 2 * * ? *)`

- [ ] **First restore test completed and logged** in [docs/restore-test-log.md](./restore-test-log.md) before production go-live
