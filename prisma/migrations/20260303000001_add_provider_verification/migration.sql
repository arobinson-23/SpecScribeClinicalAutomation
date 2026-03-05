-- CreateTable
CREATE TABLE "provider_verifications" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "practice_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "verified_by_id" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "registration_number" TEXT NOT NULL,
    "college" TEXT NOT NULL,
    "in_good_standing" BOOLEAN NOT NULL,
    "verified_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "provider_verifications_practice_id_idx" ON "provider_verifications"("practice_id");

-- CreateIndex
CREATE INDEX "provider_verifications_user_id_idx" ON "provider_verifications"("user_id");

-- AddForeignKey
ALTER TABLE "provider_verifications" ADD CONSTRAINT "provider_verifications_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_verifications" ADD CONSTRAINT "provider_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_verifications" ADD CONSTRAINT "provider_verifications_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
