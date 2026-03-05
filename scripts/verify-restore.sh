#!/usr/bin/env bash
# =============================================================================
# scripts/verify-restore.sh — Automated Backup & Restore Verification
# =============================================================================
#
# DESCRIPTION
#   End-to-end backup-and-restore smoke test against the local Docker
#   environment. Runs entirely locally — no S3 required.
#
#   Workflow:
#     1. Validate Docker + PostgreSQL container health
#     2. Query row counts from the source (dev) database
#     3. Create a local encrypted dump (bypasses S3 for test isolation)
#     4. Create a scratch restore database
#     5. Restore into the scratch database via restore.sh
#     6. Compare row counts: source vs restored
#     7. Drop the scratch database (cleanup trap)
#     8. Print pass / fail summary
#
# REQUIRED ENVIRONMENT VARIABLES
#   DATABASE_URL               Dev PostgreSQL connection string.
#   BACKUP_ENCRYPTION_PASSWORD Test passphrase for encryption — can be any
#                              value in CI; does not need to match production.
#
# REQUIRED TOOLS
#   docker        docker compose ps health check
#   pg_dump       create the dump
#   pg_restore    validate & restore the dump
#   psql          row count queries
#   createdb      create scratch database
#   dropdb        drop scratch database (cleanup)
#   openssl       encrypt / decrypt the dump
#
# CI INTEGRATION
#   See .github/workflows/backup-verify.yml for scheduled weekly execution.
#   To run manually: DATABASE_URL=... BACKUP_ENCRYPTION_PASSWORD=test \
#     bash scripts/verify-restore.sh
#
# =============================================================================

set -euo pipefail

# ─── Setup ───────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")
SCRATCH_DB="specscribe_restore_test_${TIMESTAMP}"
TMP_DUMP="/tmp/verify_backup_${TIMESTAMP}.dump"
TMP_ENC="/tmp/verify_backup_${TIMESTAMP}.dump.enc"

PASS=0
FAIL=0

# Placeholders so the cleanup trap can reference them safely before they are set
SRC_HOST=""
SRC_PORT=""
SRC_USER=""

# ─── Logging ─────────────────────────────────────────────────────────────────

log() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S')] VERIFY: $*"
}

die() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S')] VERIFY ERROR: $*" >&2
  exit 1
}

# ─── Cleanup trap ────────────────────────────────────────────────────────────

cleanup() {
  log "Cleaning up..."
  rm -f "$TMP_DUMP" "$TMP_ENC"

  # Drop the scratch database only if we have a valid connection and a DB name
  if [ -n "$SRC_HOST" ] && [ -n "$SCRATCH_DB" ]; then
    dropdb \
      --host="$SRC_HOST" \
      --port="$SRC_PORT" \
      --username="$SRC_USER" \
      --no-password \
      --if-exists \
      "$SCRATCH_DB" 2>/dev/null \
    && log "Scratch database '${SCRATCH_DB}' dropped." \
    || log "Could not drop scratch database '${SCRATCH_DB}' — drop manually if needed."
  fi
}
trap cleanup EXIT

# ─── Validate required env vars ───────────────────────────────────────────────

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_PASSWORD:?BACKUP_ENCRYPTION_PASSWORD is required}"

# ─── Tool check ───────────────────────────────────────────────────────────────

log "Checking required tools..."
command -v docker     >/dev/null 2>&1 || die "docker not found."
command -v pg_dump    >/dev/null 2>&1 || die "pg_dump not found."
command -v pg_restore >/dev/null 2>&1 || die "pg_restore not found."
command -v psql       >/dev/null 2>&1 || die "psql not found."
command -v createdb   >/dev/null 2>&1 || die "createdb not found."
command -v dropdb     >/dev/null 2>&1 || die "dropdb not found."
command -v openssl    >/dev/null 2>&1 || die "openssl not found."

# ─── Pre-condition: Docker + PostgreSQL container health ─────────────────────

log "Checking PostgreSQL container health via docker compose..."

POSTGRES_HEALTH=$(docker compose ps postgres --format json 2>/dev/null \
  | grep -o '"Health":"[^"]*"' \
  | head -1 \
  | cut -d'"' -f4 \
  || echo "unknown")

if [ "$POSTGRES_HEALTH" != "healthy" ]; then
  log "postgres container health: ${POSTGRES_HEALTH}"
  die "PostgreSQL container is not healthy. Run: docker compose up -d postgres && docker compose ps postgres"
fi

log "PostgreSQL container is healthy."

# ─── Parse DATABASE_URL ───────────────────────────────────────────────────────

_url="${DATABASE_URL#postgresql://}"
_url="${_url#postgres://}"

_userinfo="${_url%%@*}"
_rest="${_url#*@}"

SRC_USER="${_userinfo%%:*}"
SRC_PASSWORD="${_userinfo#*:}"

_hostport="${_rest%%/*}"
_dbpath="${_rest#*/}"

SRC_HOST="${_hostport%%:*}"
_portpart="${_hostport##*:}"
if [ "$_portpart" = "$SRC_HOST" ]; then
  SRC_PORT="5432"
else
  SRC_PORT="$_portpart"
fi

SRC_DB_NAME="${_dbpath%%\?*}"

export PGPASSWORD="$SRC_PASSWORD"

log "Source database: host=${SRC_HOST} port=${SRC_PORT} dbname=${SRC_DB_NAME} user=${SRC_USER}"

# ─── Helper: row count ───────────────────────────────────────────────────────

count_rows() {
  local host="$1" port="$2" user="$3" db="$4" table="$5"
  psql \
    --host="$host" \
    --port="$port" \
    --username="$user" \
    --dbname="$db" \
    --no-password \
    --tuples-only \
    --no-align \
    --command="SELECT COUNT(*) FROM ${table};" 2>/dev/null \
  || echo "0"
}

# ─── Step 1: Capture source row counts ───────────────────────────────────────

log "Querying source row counts..."

SRC_PRACTICES=$( count_rows "$SRC_HOST" "$SRC_PORT" "$SRC_USER" "$SRC_DB_NAME" "practices")
SRC_USERS=$(     count_rows "$SRC_HOST" "$SRC_PORT" "$SRC_USER" "$SRC_DB_NAME" "users")
SRC_PATIENTS=$(  count_rows "$SRC_HOST" "$SRC_PORT" "$SRC_USER" "$SRC_DB_NAME" "patients")
SRC_ENCOUNTERS=$(count_rows "$SRC_HOST" "$SRC_PORT" "$SRC_USER" "$SRC_DB_NAME" "encounters")
SRC_AUDIT=$(     count_rows "$SRC_HOST" "$SRC_PORT" "$SRC_USER" "$SRC_DB_NAME" "audit_log")

log "Source row counts:"
log "  practices:  $SRC_PRACTICES"
log "  users:      $SRC_USERS"
log "  patients:   $SRC_PATIENTS"
log "  encounters: $SRC_ENCOUNTERS"
log "  audit_log:  $SRC_AUDIT"

if [ "$SRC_PRACTICES" -lt 1 ] 2>/dev/null || [ "$SRC_USERS" -lt 1 ] 2>/dev/null; then
  log "Warning: source database appears empty (practices=${SRC_PRACTICES}, users=${SRC_USERS})."
  log "Consider running: npx prisma db seed"
  log "Proceeding — empty database counts should still match after restore."
fi

# ─── Step 2: Create local encrypted dump ─────────────────────────────────────

log "Creating PostgreSQL dump (custom format, compression level 9)..."

pg_dump \
  --host="$SRC_HOST" \
  --port="$SRC_PORT" \
  --username="$SRC_USER" \
  --dbname="$SRC_DB_NAME" \
  --format=custom \
  --compress=9 \
  --no-password \
  --file="$TMP_DUMP"

log "Encrypting dump (AES-256-CBC, pbkdf2, 100 000 iterations)..."

openssl enc -aes-256-cbc -pbkdf2 -iter 100000 \
  -in  "$TMP_DUMP" \
  -out "$TMP_ENC" \
  -pass env:BACKUP_ENCRYPTION_PASSWORD

# Remove plaintext immediately
rm -f "$TMP_DUMP"

log "Encrypted dump ready: $TMP_ENC"

# ─── Step 3: Create scratch restore database ──────────────────────────────────

log "Creating scratch database: $SCRATCH_DB"

createdb \
  --host="$SRC_HOST" \
  --port="$SRC_PORT" \
  --username="$SRC_USER" \
  --no-password \
  "$SCRATCH_DB"

log "Scratch database created."

# ─── Step 4: Restore via restore.sh ──────────────────────────────────────────

SCRATCH_DB_URL="postgresql://${SRC_USER}:${SRC_PASSWORD}@${SRC_HOST}:${SRC_PORT}/${SCRATCH_DB}"

log "Running restore.sh → scratch database..."

BACKUP_ENCRYPTION_PASSWORD="$BACKUP_ENCRYPTION_PASSWORD" \
  bash "${SCRIPT_DIR}/restore.sh" \
    --db-backup "$TMP_ENC" \
    --target-db "$SCRATCH_DB_URL"

log "restore.sh completed."

# ─── Step 5: Compare row counts ───────────────────────────────────────────────

log "Comparing row counts: source vs restored..."

RST_PRACTICES=$( count_rows "$SRC_HOST" "$SRC_PORT" "$SRC_USER" "$SCRATCH_DB" "practices")
RST_USERS=$(     count_rows "$SRC_HOST" "$SRC_PORT" "$SRC_USER" "$SCRATCH_DB" "users")
RST_PATIENTS=$(  count_rows "$SRC_HOST" "$SRC_PORT" "$SRC_USER" "$SCRATCH_DB" "patients")
RST_ENCOUNTERS=$(count_rows "$SRC_HOST" "$SRC_PORT" "$SRC_USER" "$SCRATCH_DB" "encounters")
RST_AUDIT=$(     count_rows "$SRC_HOST" "$SRC_PORT" "$SRC_USER" "$SCRATCH_DB" "audit_log")

assert_equal() {
  local table="$1" src="$2" rst="$3"
  if [ "$src" = "$rst" ]; then
    log "  PASS  ${table}: ${src} rows"
    PASS=$((PASS + 1))
  else
    log "  FAIL  ${table}: source=${src}  restored=${rst}  (MISMATCH)"
    FAIL=$((FAIL + 1))
  fi
}

assert_equal "practices"  "$SRC_PRACTICES"  "$RST_PRACTICES"
assert_equal "users"      "$SRC_USERS"      "$RST_USERS"
assert_equal "patients"   "$SRC_PATIENTS"   "$RST_PATIENTS"
assert_equal "encounters" "$SRC_ENCOUNTERS" "$RST_ENCOUNTERS"
assert_equal "audit_log"  "$SRC_AUDIT"      "$RST_AUDIT"

# ─── Summary ─────────────────────────────────────────────────────────────────

echo ""
echo "=================================================="
if [ "$FAIL" -eq 0 ]; then
  echo "  BACKUP AND RESTORE VERIFIED — ${PASS}/${PASS} checks passed"
  echo "  practices:  $RST_PRACTICES"
  echo "  users:      $RST_USERS"
  echo "  patients:   $RST_PATIENTS"
  echo "  encounters: $RST_ENCOUNTERS"
  echo "  audit_log:  $RST_AUDIT"
  echo "  restored correctly from encrypted local dump"
  echo "=================================================="
  exit 0
else
  echo "  BACKUP AND RESTORE FAILED — ${FAIL} check(s) failed"
  echo "  Passed: $PASS  Failed: $FAIL"
  echo "=================================================="
  exit 1
fi
