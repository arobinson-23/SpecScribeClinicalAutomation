-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('provider', 'admin', 'biller', 'staff', 'superadmin');

-- CreateEnum
CREATE TYPE "EncounterStatus" AS ENUM ('not_started', 'in_progress', 'ai_processing', 'needs_review', 'note_finalized', 'finalized');

-- CreateEnum
CREATE TYPE "SpecialtyType" AS ENUM ('behavioral_health', 'dermatology', 'orthopedics', 'pain_management', 'oncology');

-- CreateEnum
CREATE TYPE "NoteType" AS ENUM ('progress_note', 'intake', 'biopsychosocial', 'treatment_plan', 'procedure', 'consultation', 'discharge');

-- CreateEnum
CREATE TYPE "NoteFormat" AS ENUM ('SOAP', 'DAP', 'BIRP', 'NARRATIVE');

-- CreateEnum
CREATE TYPE "CodeType" AS ENUM ('CPT', 'ICD10', 'HCPCS');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('draft', 'submitted', 'pending', 'paid', 'denied', 'appealed', 'written_off');

-- CreateEnum
CREATE TYPE "PriorAuthStatus" AS ENUM ('not_required', 'pending_submission', 'submitted', 'under_review', 'approved', 'denied', 'appealed', 'expired');

-- CreateEnum
CREATE TYPE "ComplianceAlertSeverity" AS ENUM ('info', 'warning', 'critical');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'LOGIN', 'LOGOUT', 'MFA_VERIFY', 'MFA_SETUP', 'FAILED_AUTH', 'PERMISSION_CHANGE', 'CONFIG_CHANGE', 'AI_INVOCATION');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('basic', 'professional', 'enterprise');

-- CreateTable
CREATE TABLE "practices" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "specialty" "SpecialtyType" NOT NULL DEFAULT 'behavioral_health',
    "npi" TEXT NOT NULL,
    "tax_id" TEXT,
    "address" JSONB NOT NULL,
    "phone" TEXT,
    "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'basic',
    "stripe_customer_id" TEXT,
    "stripe_sub_id" TEXT,
    "fhir_base_url" TEXT,
    "fhir_client_id" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "practices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "practice_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'staff',
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "npi" TEXT,
    "credentials" TEXT,
    "mfa_secret" TEXT,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_backup_codes" JSONB NOT NULL DEFAULT '[]',
    "password_history" JSONB NOT NULL DEFAULT '[]',
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "last_login_ip" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "invited_at" TIMESTAMP(3),
    "invite_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "mfa_verified" BOOLEAN NOT NULL DEFAULT false,
    "device_hash" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "last_activity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "practice_id" TEXT NOT NULL,
    "mrn" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "dob" TEXT NOT NULL,
    "sex" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "insurance_json" TEXT,
    "fhir_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounters" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "practice_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "encounter_date" TIMESTAMP(3) NOT NULL,
    "status" "EncounterStatus" NOT NULL DEFAULT 'not_started',
    "specialty_type" "SpecialtyType" NOT NULL,
    "audio_file_key" TEXT,
    "audio_duration" INTEGER,
    "fhir_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounter_notes" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "encounter_id" TEXT NOT NULL,
    "note_type" "NoteType" NOT NULL,
    "note_format" "NoteFormat" NOT NULL DEFAULT 'SOAP',
    "raw_transcript" TEXT,
    "ai_generated_note" TEXT,
    "provider_edited_note" TEXT,
    "ai_acceptance_rate" DOUBLE PRECISION,
    "word_count" INTEGER,
    "finalized_at" TIMESTAMP(3),
    "finalized_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encounter_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounter_codes" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "encounter_id" TEXT NOT NULL,
    "code_type" "CodeType" NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "modifier" TEXT,
    "units" INTEGER NOT NULL DEFAULT 1,
    "ai_confidence" DOUBLE PRECISION,
    "ai_rationale" TEXT,
    "reasoning" TEXT,
    "denial_risk_score" DOUBLE PRECISION,
    "provider_accepted" BOOLEAN,
    "provider_modified" BOOLEAN NOT NULL DEFAULT false,
    "accepted_at" TIMESTAMP(3),
    "accepted_by" TEXT,
    "final_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encounter_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_interactions" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "encounter_id" TEXT NOT NULL,
    "interaction_type" TEXT NOT NULL,
    "prompt_hash" TEXT NOT NULL,
    "output_hash" TEXT,
    "model_version" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "provider_action" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specialty_templates" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "specialty" "SpecialtyType" NOT NULL,
    "note_type" "NoteType" NOT NULL,
    "note_format" "NoteFormat" NOT NULL,
    "template_content" TEXT NOT NULL,
    "prompt_addendum" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "specialty_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prior_auth_requests" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "practice_id" TEXT NOT NULL,
    "encounter_id" TEXT NOT NULL,
    "payer_id" TEXT NOT NULL,
    "payer_name" TEXT NOT NULL,
    "procedure_codes" JSONB NOT NULL,
    "diagnosis_codes" JSONB NOT NULL,
    "status" "PriorAuthStatus" NOT NULL DEFAULT 'not_required',
    "auth_number" TEXT,
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "denied_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "denial_reason" TEXT,
    "clinical_summary" TEXT,
    "supporting_docs" JSONB NOT NULL DEFAULT '[]',
    "appeal_deadline" TIMESTAMP(3),
    "appeal_submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prior_auth_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_submissions" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "practice_id" TEXT NOT NULL,
    "encounter_id" TEXT NOT NULL,
    "payer_id" TEXT NOT NULL,
    "payer_name" TEXT NOT NULL,
    "codes_json" JSONB NOT NULL,
    "billed_amount" DECIMAL(10,2) NOT NULL,
    "allowed_amount" DECIMAL(10,2),
    "paid_amount" DECIMAL(10,2),
    "status" "ClaimStatus" NOT NULL DEFAULT 'draft',
    "submitted_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "denial_reason" TEXT,
    "denial_code" TEXT,
    "appealed_at" TIMESTAMP(3),
    "external_claim_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "claim_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payer_rules" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "payer_name" TEXT NOT NULL,
    "payer_id" TEXT,
    "specialty" "SpecialtyType" NOT NULL,
    "rule_type" TEXT NOT NULL,
    "rule_content" JSONB NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payer_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_payer_rules" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "practice_id" TEXT NOT NULL,
    "payer_rule_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_payer_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_alerts" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "practice_id" TEXT NOT NULL,
    "alert_type" TEXT NOT NULL,
    "severity" "ComplianceAlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "specialty" "SpecialtyType",
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "embedding" vector(1536),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "practice_id" TEXT NOT NULL,
    "user_id" TEXT,
    "user_role" TEXT,
    "session_id" TEXT,
    "action" "AuditAction" NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'success',
    "error_code" TEXT,
    "fields_accessed" JSONB,
    "fields_changed" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "previous_hash" TEXT,
    "entry_hash" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "practice_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "practices_npi_key" ON "practices"("npi");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_practice_id_idx" ON "users"("practice_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_session_token_idx" ON "sessions"("session_token");

-- CreateIndex
CREATE INDEX "patients_practice_id_idx" ON "patients"("practice_id");

-- CreateIndex
CREATE UNIQUE INDEX "patients_practice_id_mrn_key" ON "patients"("practice_id", "mrn");

-- CreateIndex
CREATE INDEX "encounters_practice_id_idx" ON "encounters"("practice_id");

-- CreateIndex
CREATE INDEX "encounters_patient_id_idx" ON "encounters"("patient_id");

-- CreateIndex
CREATE INDEX "encounters_provider_id_idx" ON "encounters"("provider_id");

-- CreateIndex
CREATE INDEX "encounters_encounter_date_idx" ON "encounters"("encounter_date");

-- CreateIndex
CREATE INDEX "encounter_notes_encounter_id_idx" ON "encounter_notes"("encounter_id");

-- CreateIndex
CREATE INDEX "encounter_codes_encounter_id_idx" ON "encounter_codes"("encounter_id");

-- CreateIndex
CREATE INDEX "ai_interactions_encounter_id_idx" ON "ai_interactions"("encounter_id");

-- CreateIndex
CREATE UNIQUE INDEX "specialty_templates_specialty_note_type_note_format_version_key" ON "specialty_templates"("specialty", "note_type", "note_format", "version");

-- CreateIndex
CREATE INDEX "prior_auth_requests_practice_id_idx" ON "prior_auth_requests"("practice_id");

-- CreateIndex
CREATE INDEX "prior_auth_requests_encounter_id_idx" ON "prior_auth_requests"("encounter_id");

-- CreateIndex
CREATE INDEX "claim_submissions_practice_id_idx" ON "claim_submissions"("practice_id");

-- CreateIndex
CREATE INDEX "claim_submissions_encounter_id_idx" ON "claim_submissions"("encounter_id");

-- CreateIndex
CREATE INDEX "payer_rules_payer_name_specialty_idx" ON "payer_rules"("payer_name", "specialty");

-- CreateIndex
CREATE UNIQUE INDEX "practice_payer_rules_practice_id_payer_rule_id_key" ON "practice_payer_rules"("practice_id", "payer_rule_id");

-- CreateIndex
CREATE INDEX "compliance_alerts_practice_id_idx" ON "compliance_alerts"("practice_id");

-- CreateIndex
CREATE INDEX "compliance_alerts_resolved_at_idx" ON "compliance_alerts"("resolved_at");

-- CreateIndex
CREATE INDEX "knowledge_chunks_source_type_specialty_idx" ON "knowledge_chunks"("source_type", "specialty");

-- CreateIndex
CREATE INDEX "audit_log_practice_id_timestamp_idx" ON "audit_log"("practice_id", "timestamp");

-- CreateIndex
CREATE INDEX "audit_log_user_id_idx" ON "audit_log"("user_id");

-- CreateIndex
CREATE INDEX "analytics_events_practice_id_event_type_timestamp_idx" ON "analytics_events"("practice_id", "event_type", "timestamp");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_notes" ADD CONSTRAINT "encounter_notes_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_codes" ADD CONSTRAINT "encounter_codes_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prior_auth_requests" ADD CONSTRAINT "prior_auth_requests_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prior_auth_requests" ADD CONSTRAINT "prior_auth_requests_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_submissions" ADD CONSTRAINT "claim_submissions_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_submissions" ADD CONSTRAINT "claim_submissions_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_payer_rules" ADD CONSTRAINT "practice_payer_rules_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_payer_rules" ADD CONSTRAINT "practice_payer_rules_payer_rule_id_fkey" FOREIGN KEY ("payer_rule_id") REFERENCES "payer_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_alerts" ADD CONSTRAINT "compliance_alerts_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
