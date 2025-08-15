/*
  Warnings:

  - You are about to drop the column `spend_basis` on the `ReferralRules` table. All the data in the column will be lost.
  - You are about to drop the column `spend_basis_token` on the `ReferralRules` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ReferralCriteriaModes" AS ENUM ('POINTS', 'TRANSACTIONS', 'SWAPS_ONLY', 'MINTS_ONLY');

-- AlterTable
ALTER TABLE "ReferralRules" DROP COLUMN "spend_basis",
DROP COLUMN "spend_basis_token",
ADD COLUMN     "criteria" "ReferralCriteriaModes" NOT NULL DEFAULT 'POINTS',
ADD COLUMN     "criteria_token" TEXT;

-- DropEnum
DROP TYPE "ReferralSpendBasis";
