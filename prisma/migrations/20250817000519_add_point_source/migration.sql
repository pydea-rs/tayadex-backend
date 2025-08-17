-- CreateEnum
CREATE TYPE "PointSources" AS ENUM ('TRANSACTION', 'DIRECT_REFERRAL', 'INDIRECT_REFERRAL', 'ACTIVISION_REFERRAL', 'ACTIVITY');

-- DropForeignKey
ALTER TABLE "PointHistory" DROP CONSTRAINT "PointHistory_ruleId_fkey";

-- AlterTable
ALTER TABLE "PointHistory" ADD COLUMN     "source" "PointSources" NOT NULL DEFAULT 'TRANSACTION',
ALTER COLUMN "ruleId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "PointHistory" ADD CONSTRAINT "PointHistory_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "PointSystemRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
