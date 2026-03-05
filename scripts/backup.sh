#!/usr/bin/env bash
# =============================================================================
# scripts/backup.sh — SpecScribe PostgreSQL + Object Store Backup
# =============================================================================
#
# DESCRIPTION
#   Backs up the SpecScribe PostgreSQL database and MinIO/S3 object store to
#   an encrypted archive in a separate S3 backup bucket. Designed for daily
#   automated execution via cron or AWS EventBridge.
#
# REQUIRED ENVIRONMENT VARIABLES
#   DATABASE_URL               PostgreSQL connection string:
#                              postgresql://user:password@host:port/dbname
#   BACKUP_ENCRYPTION_PASSWORD Passphrase for AES-256-CBC encryption of the
#                              database dump. Store in AWS Secrets Manager.
#                              NEVER set this to the same value as APP_SECRET.
#   BACKUP_DEST_S3_BUCKET      Name of the S3 bucket that receives backup
#                              archives (separate from the application bucket).
#   BACKUP_DEST_S3_PREFIX      S3 key prefix for all backup objects,
#                              e.g. backups/specscribe/
#
# OPTIONAL ENVIRONMENT VARIABLES
#   AWS_S3_BUCKET    Application bucket to mirror (object store backup).
#                    If not set, the object-store mirror step is skipped.
#   AWS_ENDPOINT_URL Override S3 endpoint (e.g. http://localhost:9000 for
#                    local MinIO). Omit for real AWS S3.
#   AWS_REGION       AWS region (default: ca-central-1).
#
# REQUIRED TOOLS
#   pg_dump    (postgresql-client package)
#   openssl    (version 1.1.1+ — required for -pbkdf2 flag)
#   aws        (AWS CLI v2)
#
# NOTE ON OBJECT-STORE ENCRYPTION
#   This script does NOT re-encrypt the MinIO/S3 mirror — it relies on the
#   destination bucket having SSE-S3 or SSE-KMS enabled at the bucket level.
#   Confirm this is configured before enabling the mirror step in production.
#
# RTO TARGET
#   72 hours — backups must be restorable within 72 hours of a declared
#   incident (HIA / PIPEDA benchmark adopted by SpecScribe).
#
# RETENTION POLICY
#   90 days minimum on the backup bucket (enforced via S3 Object Lock /
#   Lifecycle rules — manual setup required; see docs/backup-restore-runbook.md).
#   10-year legal retention of health records is satisfied by the live database
#   and does NOT require keeping backup archives for 10 years.
#
# CRON SCHEDULE (run daily at 02:00 UTC)
#   0 2 * * * /app/scripts/backup.sh >> /var/log/specscribe-backup.log 2>&1
#
# =============================================================================

set -euo pipefail

# ─── Timestamps & temp paths ─────────────────────────────────────────────────

TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")
DATE_PREFIX=$(date -u +"%Y%m%d")
TMP_DUMP="/tmp/specscribe_db_${TIMESTAMP}.dump"
TMP_ENC="/tmp/specscribe_db_${TIMESTAMP}.dump.enc"

# ─── Logging ─────────────────────────────────────────────────────────────────

log() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S')] BACKUP: $*"
}

die() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S')] BACKUP ERROR: $*" >&2
  exit 1
}

# ─── Cleanup trap (runs on exit, even on error) ───────────────────────────────

cleanup() {
  log "Cleaning up temporary files..."
  rm -f "$TMP_DUMP" "$TMP_ENC"
}
trap cleanup EXIT

# ─── Validate required environment variables ──────────────────────────────────

log "Validating required environment variables..."

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_PASSWORD:?BACKUP_ENCRYPTION_PASSWORD is required}"
: "${BACKUP_DEST_S3_BUCKET:?BACKUP_DEST_S3_BUCKET is required}"
: "${BACKUP_DEST_S3_PREFIX:?BACKUP_DEST_S3_PREFIX is required}"

# ─── Parse DATABASE_URL ───────────────────────────────────────────────────────
# Supports: postgresql://user:password@host:port/dbname[?params]
#       and: postgres://user:password@host:port/dbname[?params]

log "Parsing database connection string..."

_url="${DATABASE_URL#postgresql://}"
_url="${_url#postgres://}"

_userinfo="${_url%%@*}"
_rest="${_url#*@}"

DB_USER="${_userinfo%%:*}"
DB_PASSWORD="${_userinfo#*:}"

_hostport="${_rest%%/*}"
_dbpath="${_rest#*/}"

DB_HOST="${_hostport%%:*}"
_portpart="${_hostport##*:}"
if [ "$_portpart" = "$DB_HOST" ]; then
  DB_PORT="5432"
else
  DB_PORT="$_portpart"
fi

DB_NAME="${_dbpath%%\?*}"

export PGPASSWORD="$DB_PASSWORD"

log "Target database: host=${DB_HOST} port=${DB_PORT} dbname=${DB_NAME} user=${DB_USER}"

# ─── Tool availability check ─────────────────────────────────────────────────

log "Checking required tools..."
command -v pg_dump >/dev/null 2>&1 || die "pg_dump not found. Install postgresql-client."
command -v openssl >/dev/null 2>&1 || die "openssl not found."
command -v aws     >/dev/null 2>&1 || die "aws CLI not found. Install AWS CLI v2."

# ─── Build shared AWS CLI args ────────────────────────────────────────────────

AWS_ARGS=()
if [ -n "${AWS_ENDPOINT_URL:-}" ]; then
  AWS_ARGS+=("--endpoint-url" "$AWS_ENDPOINT_URL")
fi
AWS_ARGS+=("--region" "${AWS_REGION:-ca-central-1}")

# ─── Step 1: PostgreSQL dump ─────────────────────────────────────────────────

log "Starting PostgreSQL dump (custom format, compression level 9)..."

pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --format=custom \
  --compress=9 \
  --no-password \
  --file="$TMP_DUMP"

DUMP_SIZE=$(du -sh "$TMP_DUMP" | cut -f1)
log "PostgreSQL dump complete. Size: ${DUMP_SIZE}"

# ─── Step 2: Encrypt the dump ────────────────────────────────────────────────

log "Encrypting dump with AES-256-CBC (pbkdf2, 100 000 iterations)..."

openssl enc -aes-256-cbc -pbkdf2 -iter 100000 \
  -in  "$TMP_DUMP" \
  -out "$TMP_ENC" \
  -pass env:BACKUP_ENCRYPTION_PASSWORD

log "Encryption complete."

# Remove the plaintext dump immediately after encryption
rm -f "$TMP_DUMP"

# ─── Step 3: Upload encrypted dump to backup S3 bucket ───────────────────────

REMOTE_DB_KEY="${BACKUP_DEST_S3_PREFIX%/}/db/specscribe_db_${TIMESTAMP}.dump.enc"

log "Uploading encrypted dump to s3://${BACKUP_DEST_S3_BUCKET}/${REMOTE_DB_KEY}..."

aws s3 cp "${AWS_ARGS[@]}" \
  "$TMP_ENC" \
  "s3://${BACKUP_DEST_S3_BUCKET}/${REMOTE_DB_KEY}"

log "Database dump uploaded successfully."

# ─── Step 4: Object store mirror (MinIO / S3) ────────────────────────────────

if [ -n "${AWS_S3_BUCKET:-}" ]; then
  OBJECTS_DEST="s3://${BACKUP_DEST_S3_BUCKET}/${BACKUP_DEST_S3_PREFIX%/}/objects/${DATE_PREFIX}/"
  log "Mirroring object store s3://${AWS_S3_BUCKET}/ → ${OBJECTS_DEST}"
  log "REQUIREMENT: SSE-S3 or SSE-KMS must be enabled on the destination bucket."

  aws s3 sync "${AWS_ARGS[@]}" \
    "s3://${AWS_S3_BUCKET}/" \
    "$OBJECTS_DEST" \
    --no-progress

  log "Object store mirror complete."
else
  log "AWS_S3_BUCKET not set — skipping object store mirror."
fi

# ─── Summary ─────────────────────────────────────────────────────────────────

log "Backup complete."
log "  DB dump : s3://${BACKUP_DEST_S3_BUCKET}/${REMOTE_DB_KEY}"
log "  Timestamp: ${TIMESTAMP}"
log "  RTO target: 72 hours from declared incident"
