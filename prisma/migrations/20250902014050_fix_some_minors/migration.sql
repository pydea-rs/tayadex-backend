-- DropForeignKey
ALTER TABLE "ProcessedTransaction" DROP CONSTRAINT "ProcessedTransaction_chain_id_fkey";

-- AlterTable
ALTER TABLE "ProcessedTransaction" ALTER COLUMN "chain_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ProcessedTransaction" ADD CONSTRAINT "ProcessedTransaction_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "Chain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
