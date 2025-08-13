-- CreateEnum
CREATE TYPE "ReferralRewardType" AS ENUM ('POINT', 'MON');

-- DropForeignKey
ALTER TABLE "PointHistory" DROP CONSTRAINT "PointHistory_trx_id_fkey";

-- AlterTable
ALTER TABLE "PointHistory" ALTER COLUMN "trx_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ReferralRules" (
    "id" SERIAL NOT NULL,
    "activision_reward" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activision_reward_type" "ReferralRewardType" NOT NULL DEFAULT 'POINT',
    "direct_referral_ratio" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "direct_referral_type" "ReferralRewardType" NOT NULL DEFAULT 'POINT',
    "indirect_referral_ratio" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "indirect_referral_type" "ReferralRewardType" NOT NULL DEFAULT 'POINT',
    "devide_by_layer" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ReferralRules_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PointHistory" ADD CONSTRAINT "PointHistory_trx_id_fkey" FOREIGN KEY ("trx_id") REFERENCES "ProcessedTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
