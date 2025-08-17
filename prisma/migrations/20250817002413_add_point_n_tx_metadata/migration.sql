-- AlterTable
ALTER TABLE "PointHistory" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "ProcessedTransaction" ADD COLUMN     "metadata" JSONB;
