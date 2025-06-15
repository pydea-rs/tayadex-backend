/*
  Warnings:

  - Made the column `from` on table `ProcessedTransaction` required. This step will fail if there are existing NULL values in that column.
  - Made the column `to` on table `ProcessedTransaction` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ProcessedTransaction" ADD COLUMN     "user_id" INTEGER,
ALTER COLUMN "from" SET NOT NULL,
ALTER COLUMN "to" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "ProcessedTransaction" ADD CONSTRAINT "ProcessedTransaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
