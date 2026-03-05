-- MFA is now delegated to Clerk (TOTP, SMS, email code enforced at sign-in).
-- Remove the custom TOTP fields from the users table.
ALTER TABLE "users" DROP COLUMN IF EXISTS "mfa_secret";
ALTER TABLE "users" DROP COLUMN IF EXISTS "mfa_enabled";
ALTER TABLE "users" DROP COLUMN IF EXISTS "mfa_backup_codes";
