-- Migration: add_ehr_sync
--
-- Adds EHR/FHIR integration fields required for Epic appointment sync:
--   1. EhrType enum for tracking which EHR system a practice connects to
--   2. ehr_type column on practices (defaults to 'none')
--   3. ehr_last_sync_at timestamp on practices (tracks last successful sync)
--   4. Unique constraint on patients(practice_id, fhir_id) for upsert deduplication
--   5. Unique constraint on encounters(practice_id, fhir_id) for upsert deduplication
--
-- NOTE: This schema was initially applied via `prisma db push` during development.
-- This migration file captures those changes in the migration history for
-- reproducibility on fresh deployments.

-- CreateEnum
CREATE TYPE "EhrType" AS ENUM ('none', 'epic', 'meditech', 'accuro');

-- AlterTable: add ehr_type and ehr_last_sync_at to practices
ALTER TABLE "practices"
  ADD COLUMN "ehr_type" "EhrType" NOT NULL DEFAULT 'none',
  ADD COLUMN "ehr_last_sync_at" TIMESTAMP(3);

-- CreateIndex: unique patient per practice per FHIR ID (for EHR upsert)
CREATE UNIQUE INDEX "patients_practice_id_fhir_id_key" ON "patients"("practice_id", "fhir_id");

-- CreateIndex: unique encounter per practice per FHIR ID (for EHR upsert)
CREATE UNIQUE INDEX "encounters_practice_id_fhir_id_key" ON "encounters"("practice_id", "fhir_id");
