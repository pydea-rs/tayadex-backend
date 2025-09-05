/*
  Warnings:

  - The values [QUESTS] on the enum `PointSources` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PointSources_new" AS ENUM ('TRANSACTION', 'DIRECT_REFERRAL', 'INDIRECT_REFERRAL', 'ACTIVISION_REFERRAL', 'ONCHAIN_ACTIVITY', 'SOCIAL_ACTIVITY');
ALTER TABLE "PointHistory" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "PointHistory" ALTER COLUMN "source" TYPE "PointSources_new" USING ("source"::text::"PointSources_new");
ALTER TYPE "PointSources" RENAME TO "PointSources_old";
ALTER TYPE "PointSources_new" RENAME TO "PointSources";
DROP TYPE "PointSources_old";
ALTER TABLE "PointHistory" ALTER COLUMN "source" SET DEFAULT 'TRANSACTION';
COMMIT;
