-- Migration: cleanup_session_password_and_compliance_alert
--
-- 1. Drop the vestigial sessions table (Clerk owns session management)
-- 2. Make users.password_hash nullable (Clerk owns credentials)
-- 3. Add a proper unique constraint on compliance_alerts(practice_id, alert_type)
--    so the compliance check upsert can use a compound key instead of a synthetic ID

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_user_id_fkey";

-- DropTable
DROP TABLE IF EXISTS "sessions";

-- AlterTable: make password_hash nullable
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateIndex: compound unique on compliance_alerts
ALTER TABLE "compliance_alerts"
  ADD CONSTRAINT "compliance_alerts_practice_id_alert_type_key"
  UNIQUE ("practice_id", "alert_type");
