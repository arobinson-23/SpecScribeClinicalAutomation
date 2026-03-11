-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CodeType" ADD VALUE 'AHCIP';
ALTER TYPE "CodeType" ADD VALUE 'ICD10_CA';

-- AlterTable
ALTER TABLE "prior_auth_requests" ADD COLUMN     "medical_necessity_statement" TEXT,
ADD COLUMN     "missing_documentation" JSONB NOT NULL DEFAULT '[]';
