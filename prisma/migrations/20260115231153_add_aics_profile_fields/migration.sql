/*
  Warnings:

  - You are about to drop the column `auth_token` on the `admins` table. All the data in the column will be lost.
  - You are about to drop the column `auth_token` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "admins" DROP COLUMN "auth_token",
ADD COLUMN     "sessions_invalidated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "card_assigned_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "birth_city" TEXT,
ADD COLUMN     "birth_province" TEXT,
ADD COLUMN     "has_foreign_tax_code" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "auth_token",
ADD COLUMN     "sessions_invalidated_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "card_number_ranges" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT '',
    "start_number" INTEGER NOT NULL,
    "end_number" INTEGER NOT NULL,
    "padding" INTEGER NOT NULL DEFAULT 3,
    "association_year_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "card_number_ranges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "used_tokens" (
    "id" TEXT NOT NULL,
    "token_id" TEXT NOT NULL,
    "token_type" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "used_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "card_number_ranges_association_year_id_idx" ON "card_number_ranges"("association_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "used_tokens_token_id_key" ON "used_tokens"("token_id");

-- CreateIndex
CREATE INDEX "used_tokens_token_id_idx" ON "used_tokens"("token_id");

-- CreateIndex
CREATE INDEX "used_tokens_expires_at_idx" ON "used_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "user_profiles_first_name_idx" ON "user_profiles"("first_name");

-- CreateIndex
CREATE INDEX "user_profiles_last_name_idx" ON "user_profiles"("last_name");

-- CreateIndex
CREATE INDEX "user_profiles_profile_complete_idx" ON "user_profiles"("profile_complete");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- AddForeignKey
ALTER TABLE "card_number_ranges" ADD CONSTRAINT "card_number_ranges_association_year_id_fkey" FOREIGN KEY ("association_year_id") REFERENCES "association_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
