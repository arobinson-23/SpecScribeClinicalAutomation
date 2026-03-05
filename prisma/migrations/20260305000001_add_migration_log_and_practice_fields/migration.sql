-- AlterTable: practices — add provincial_registration_number and business_number
ALTER TABLE "practices" ADD COLUMN IF NOT EXISTS "provincial_registration_number" TEXT;
ALTER TABLE "practices" ADD COLUMN IF NOT EXISTS "business_number" TEXT;
ALTER TABLE "practices" ALTER COLUMN "npi" DROP NOT NULL;
ALTER TABLE "practices" ADD CONSTRAINT "practices_provincial_registration_number_key" UNIQUE ("provincial_registration_number");

-- AlterTable: users — add provincial_registration_number
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "provincial_registration_number" TEXT;

-- AlterTable: patients — add metadata
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}';

-- CreateTable: migration_logs
CREATE TABLE "migration_logs" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "practice_id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "record_id" TEXT,
    "record_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source_file" TEXT,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "migration_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "migration_logs_practice_id_idx" ON "migration_logs"("practice_id");

-- AddForeignKey
ALTER TABLE "migration_logs" ADD CONSTRAINT "migration_logs_practice_id_fkey"
    FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "migration_logs" ADD CONSTRAINT "migration_logs_admin_id_fkey"
    FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
