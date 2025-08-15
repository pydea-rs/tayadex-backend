-- CreateEnum
CREATE TYPE "ReferralSpendBasis" AS ENUM ('POINTS', 'TRANSACTIONS', 'SWAPS_ONLY', 'MINTS_ONLY');

-- AlterTable
ALTER TABLE "ReferralRules" ADD COLUMN     "spend_basis" "ReferralSpendBasis" NOT NULL DEFAULT 'POINTS',
ADD COLUMN     "spend_basis_token" TEXT;
