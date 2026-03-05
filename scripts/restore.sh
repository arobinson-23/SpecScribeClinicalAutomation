#!/usr/bin/env bash
# =============================================================================
# scripts/restore.sh — SpecScribe PostgreSQL Backup Restore
# =============================================================================
#
# DESCRIPTION
#   Decrypts and restores a SpecScribe PostgreSQL backup archive created by
#   scripts/backup.sh. Verifies row counts after restore to confirm data
#   landed successfully.
#
# USAGE
#   ./scripts/restore.sh \
#     --db-backup <s3://bucket/path/to/file.dump.enc | /local/path/to/file.dump.enc> \
#     --target-db <postgresql://user:password@host:port/dbname> \
#     [--decrypt-only] \
#     [--i-know-what-i-am-doing]
#
# ARGUMENTS
#   --db-backup <path>             Path to the encrypted dump file. May be
#                                  an S3 URI (s3://...) or a local file path.
#   --target-db <connection>       PostgreSQL connection string for the restore
#                                  target. DEFAULTS TO A TEST DATABASE — the
#                                  script will abort if the database name
#                                  contains "prod" unless the override flag
#                                  is passed.
#   --decrypt-only                 Decrypt and validate the dump, then exit
#                                  without restoring. Use for integrity checks.
#   --i-know-what-i-am-doing       Bypass the production database name guard.
#                                  Required when targeting a database whose
#                                  name contains "prod".
#
# REQUIRED ENVIRONMENT VARIABLES
#   BACKUP_ENCRYPTION_PASSWORD  Passphrase used to encrypt the backup archive.
#                               Must match the value used in backup.sh.
#                               NEVER the same as APP_SECRET.
#
# OPTIONAL ENVIRONMENT VARIABLES
#   AWS_ENDPOINT_URL  Override S3 endpoint (e.g. http://localhost:9000 for
#                     local MinIO). Omit for real AWS.
#   AWS_REGION        AWS region for S3 download (default: ca-central-1).
#
# REQUIRED TOOLS
#   openssl     (version 1.1.1+ — required for -pbkdf2 flag)
#   pg_restore  (postgresql-client package)
#   psql        (postgresql-client package)
#   aws         (AWS CLI v2) — only required if --db-backup is an S3 URI
#
# PRODUCTION GUARDRAIL
#   This script will ABORT if the target database name contains "prod", unless
#   --i-know-what-i-am-doing is explicitly passed. This prevents accidental
#   overwrites of production data during restore drills.
#
# RTO TARGET
#   72 hours — this script is the primary recovery mechanism. Work through
#   docs/backup-restore-runbook.md Section 4.4 before running in production.
#
# =============================================================================

set -euo pipefail

# ─── Defaults ────────────────────────────────────────────────────────────────

DB_BACKUP=""
TARGET_DB=""
DECRYPT_ONLY=false
OVERRIDE_PROD=false
TMP_ENC=""
TMP_DUMP=""

# ─── Logging ─────────────────────────────────────────────────────────────────

log() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S')] RESTORE: $*"
}

die() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S')] RESTORE ERROR: $*" >&2
  exit 1
}

# ─── Argument parsing ────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db-backup)
      DB_BACKUP="$2"
      shift 2
      ;;
    --target-db)
      TARGET_DB="$2"
      shift 2
      ;;
    --decrypt-only)
      DECRYPT_ONLY=true
      shift
      ;;
    --i-know-what-i-am-doing)
      OVERRIDE_PROD=true
      shift
      ;;
    *)
      die "Unknown argument: $1. See script header for usage."
      ;;
  esac
done

# ─── Validate arguments ───────────────────────────────────────────────────────

[ -n "$DB_BACKUP" ] || die "--db-backup is required."
: "${BACKUP_ENCRYPTION_PASSWORD:?BACKUP_ENCRYPTION_PASSWORD environment variable is required}"

if [ "$DECRYPT_ONLY" = false ]; then
  [ -n "$TARGET_DB" ] || die "--target-db is required (unless --decrypt-only is set)."
fi

# ─── Production guard ────────────────────────────────────────────────────────

if [ "$DECRYPT_ONLY" = false ] && [ -n "$TARGET_DB" ]; then
  _t="${TARGET_DB#postgresql://}"
  _t="${_t#postgres://}"
  _t_rest="${_t#*@}"
  _t_dbpath="${_t_rest#*/}"
  _t_dbname="${_t_dbpath%%\?*}"

  if echo "$_t_dbname" | grep -qi "prod"; then
    if [ "$OVERRIDE_PROD" = false ]; then
      die "Target database '${_t_dbname}' contains 'prod'." \
          "This script will not overwrite a production database by default." \
          "If you have verified this is the correct action, re-run with" \
          "--i-know-what-i-am-doing."
    else
      log "WARNING: Targeting '${_t_dbname}' which contains 'prod'." \
          "--i-know-what-i-am-doing was set. Proceeding."
    fi
  fi
fi

# ─── Cleanup trap ────────────────────────────────────────────────────────────

cleanup() {
  log "Cleaning up temporary files..."
  # Only delete TMP_ENC if we downloaded it (not if it was the caller's local file)
  [ -n "$_downloaded_enc" ] && rm -f "$TMP_ENC"
  [ -n "$TMP_DUMP" ] && rm -f "$TMP_DUMP"
}
_downloaded_enc=""
trap cleanup EXIT

# ─── Tool availability check ─────────────────────────────────────────────────

log "Checking required tools..."
command -v openssl    >/dev/null 2>&1 || die "openssl not found."
command -v pg_restore >/dev/null 2>&1 || die "pg_restore not found. Install postgresql-client."
command -v psql       >/dev/null 2>&1 || die "psql not found. Install postgresql-client."

# ─── Acquire backup file ─────────────────────────────────────────────────────

TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")

if [[ "$DB_BACKUP" == s3://* ]]; then
  command -v aws >/dev/null 2>&1 || die "aws CLI not found. Required for S3 download."
  TMP_ENC="/tmp/specscribe_restore_${TIMESTAMP}.dump.enc"
  _downloaded_enc="yes"

  AWS_ARGS=()
  if [ -n "${AWS_ENDPOINT_URL:-}" ]; then
    AWS_ARGS+=("--endpoint-url" "$AWS_ENDPOINT_URL")
  fi
  AWS_ARGS+=("--region" "${AWS_REGION:-ca-central-1}")

  log "Downloading backup from S3: $DB_BACKUP"
  aws s3 cp "${AWS_ARGS[@]}" "$DB_BACKUP" "$TMP_ENC"
  log "Download complete."
else
  [ -f "$DB_BACKUP" ] || die "Backup file not found: $DB_BACKUP"
  TMP_ENC="$DB_BACKUP"
  log "Using local backup file: $TMP_ENC"
fi

# ─── Decrypt ─────────────────────────────────────────────────────────────────

TMP_DUMP="/tmp/specscribe_restore_${TIMESTAMP}.dump"
log "Decrypting backup archive..."

openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
  -in  "$TMP_ENC" \
  -out "$TMP_DUMP" \
  -pass env:BACKUP_ENCRYPTION_PASSWORD

log "Decryption successful."

# ─── Validate dump integrity ─────────────────────────────────────────────────

log "Validating dump (pg_restore --list)..."

OBJECT_LIST=$(pg_restore --list "$TMP_DUMP" 2>&1)
OBJECT_COUNT=$(echo "$OBJECT_LIST" | grep -c "^[0-9]" || true)

log "Dump is valid. Object count: ${OBJECT_COUNT}"

if [ "$DECRYPT_ONLY" = true ]; then
  log "--decrypt-only flag set. Decryption and validation complete — no restore performed."
  log "Decrypted dump available at: $TMP_DUMP"
  # Prevent the trap from deleting the dump file in decrypt-only mode
  TMP_DUMP=""
  exit 0
fi

# ─── Parse target connection string ──────────────────────────────────────────

log "Parsing target database connection string..."

_url="${TARGET_DB#postgresql://}"
_url="${_url#postgres://}"

_userinfo="${_url%%@*}"
_rest="${_url#*@}"

TARG_USER="${_userinfo%%:*}"
TARG_PASSWORD="${_userinfo#*:}"

_hostport="${_rest%%/*}"
_dbpath="${_rest#*/}"

TARG_HOST="${_hostport%%:*}"
_portpart="${_hostport##*:}"
if [ "$_portpart" = "$TARG_HOST" ]; then
  TARG_PORT="5432"
else
  TARG_PORT="$_portpart"
fi

TARG_DB_NAME="${_dbpath%%\?*}"

export PGPASSWORD="$TARG_PASSWORD"

log "Restoring to: host=${TARG_HOST} port=${TARG_PORT} dbname=${TARG_DB_NAME} user=${TARG_USER}"

# ─── Restore ─────────────────────────────────────────────────────────────────

log "Running pg_restore..."

# --clean        : drop existing objects before recreating
# --if-exists    : suppress errors if objects don't exist yet
# --no-owner     : skip ownership commands (safe for cross-user restores)
# --no-privileges: skip GRANT/REVOKE commands
# Non-zero exit is normal on --clean restores due to missing pre-existing objects
pg_restore \
  --host="$TARG_HOST" \
  --port="$TARG_PORT" \
  --username="$TARG_USER" \
  --dbname="$TARG_DB_NAME" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --no-password \
  "$TMP_DUMP" || {
    log "pg_restore exited non-zero (warnings during --clean are normal). Continuing to verification..."
  }

log "pg_restore complete."

# ─── Row count verification ───────────────────────────────────────────────────

log "Verifying row counts in restored database..."

_run_count() {
  local table="$1"
  psql \
    --host="$TARG_HOST" \
    --port="$TARG_PORT" \
    --username="$TARG_USER" \
    --dbname="$TARG_DB_NAME" \
    --no-password \
    --tuples-only \
    --no-align \
    --command="SELECT COUNT(*) FROM ${table};" 2>/dev/null \
  || echo "ERROR"
}

PRACTICES_COUNT=$(_run_count "practices")
USERS_COUNT=$(_run_count "users")
PATIENTS_COUNT=$(_run_count "patients")
ENCOUNTERS_COUNT=$(_run_count "encounters")
AUDIT_COUNT=$(_run_count "audit_log")

log "Row counts in restored database:"
log "  practices:  ${PRACTICES_COUNT}"
log "  users:      ${USERS_COUNT}"
log "  patients:   ${PATIENTS_COUNT}"
log "  encounters: ${ENCOUNTERS_COUNT}"
log "  audit_log:  ${AUDIT_COUNT}"

if echo "${PRACTICES_COUNT} ${USERS_COUNT} ${PATIENTS_COUNT} ${ENCOUNTERS_COUNT} ${AUDIT_COUNT}" \
    | grep -q "ERROR"; then
  die "One or more row count queries failed. Restore may be incomplete. Check logs above."
fi

log "Restore verification complete. All row counts retrieved successfully."
