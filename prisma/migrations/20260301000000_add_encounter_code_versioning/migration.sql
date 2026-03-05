-- Migration: add_encounter_code_versioning
--
-- Adds `version` (monotonic batch counter) and `superseded_at` (nullable
-- timestamp) to encounter_codes so that re-running AI code suggestions
-- supersedes the previous un-reviewed batch rather than deleting it.
--
-- Invariant enforced by application logic:
--   * superseded_at IS NULL  →  active/current suggestion
--   * superseded_at IS NOT NULL  →  historical, replaced by a later AI run
--   * provider-reviewed rows (provider_accepted IS NOT NULL) are NEVER
--     superseded; they represent a provider decision and must be kept as-is.

ALTER TABLE "encounter_codes"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "superseded_at" TIMESTAMPTZ;

-- Replace the single-column index with a compound one.
-- PostgreSQL can still use this index for queries that filter only on
-- encounter_id (leading column), so no query regression.
DROP INDEX IF EXISTS "encounter_codes_encounter_id_idx";
CREATE INDEX "encounter_codes_encounter_id_superseded_at_idx"
  ON "encounter_codes" ("encounter_id", "superseded_at");
