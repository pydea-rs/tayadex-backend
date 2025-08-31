/*
  Warnings:

  - The `activision_reward_type` column on the `ReferralRules` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `direct_referral_type` column on the `ReferralRules` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `indirect_referral_type` column on the `ReferralRules` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "RewardTypesEnum" AS ENUM ('POINT', 'MON');

-- CreateEnum
CREATE TYPE "MilestoneTypes" AS ENUM ('POINT', 'TOKEN', 'LIKE', 'COMMENT', 'POST');

-- AlterTable
ALTER TABLE "ReferralRules" DROP COLUMN "activision_reward_type",
ADD COLUMN     "activision_reward_type" "RewardTypesEnum" NOT NULL DEFAULT 'POINT',
DROP COLUMN "direct_referral_type",
ADD COLUMN     "direct_referral_type" "RewardTypesEnum" NOT NULL DEFAULT 'POINT',
DROP COLUMN "indirect_referral_type",
ADD COLUMN     "indirect_referral_type" "RewardTypesEnum" NOT NULL DEFAULT 'POINT';

-- DropEnum
DROP TYPE "ReferralRewardType";

-- CreateTable
CREATE TABLE "Milestone" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "type" "MilestoneTypes" NOT NULL DEFAULT 'POINT',
    "argument" TEXT,
    "value" DOUBLE PRECISION,
    "reward" DOUBLE PRECISION NOT NULL,
    "reward_type" "RewardTypesEnum" NOT NULL DEFAULT 'POINT',

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AchievedMilestones" (
    "milestone_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AchievedMilestones_pkey" PRIMARY KEY ("milestone_id","user_id")
);

-- AddForeignKey
ALTER TABLE "AchievedMilestones" ADD CONSTRAINT "AchievedMilestones_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievedMilestones" ADD CONSTRAINT "AchievedMilestones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
