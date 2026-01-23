-- AlterEnum
ALTER TYPE "MembershipStatus" ADD VALUE 'CANCELED';

-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "previous_membership_number" TEXT;
