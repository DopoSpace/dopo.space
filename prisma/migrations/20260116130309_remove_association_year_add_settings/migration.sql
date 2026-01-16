/*
  Warnings:

  - You are about to drop the column `association_year_id` on the `card_number_ranges` table. All the data in the column will be lost.
  - You are about to drop the column `association_year_id` on the `memberships` table. All the data in the column will be lost.
  - You are about to drop the `association_years` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "card_number_ranges" DROP CONSTRAINT "card_number_ranges_association_year_id_fkey";

-- DropForeignKey
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_association_year_id_fkey";

-- DropIndex
DROP INDEX "card_number_ranges_association_year_id_idx";

-- AlterTable
ALTER TABLE "card_number_ranges" DROP COLUMN "association_year_id";

-- AlterTable
ALTER TABLE "memberships" DROP COLUMN "association_year_id";

-- DropTable
DROP TABLE "association_years";

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);
