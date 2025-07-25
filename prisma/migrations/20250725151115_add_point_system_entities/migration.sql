-- CreateEnum
CREATE TYPE "PointSystemRuleType" AS ENUM ('GENERAL', 'EVENT');

-- CreateTable
CREATE TABLE "PointSystemRule" (
    "id" SERIAL NOT NULL,
    "type" "PointSystemRuleType" NOT NULL DEFAULT 'GENERAL',
    "token0" TEXT,
    "token1" TEXT,
    "trx_type" "TransactionType" NOT NULL DEFAULT 'SWAP',
    "base_value" DOUBLE PRECISION NOT NULL,
    "relative_value" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "PointSystemRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointHistory" (
    "id" BIGSERIAL NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "ruleId" INTEGER NOT NULL,
    "user_id" INTEGER,

    CONSTRAINT "PointHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PointHistory" ADD CONSTRAINT "PointHistory_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "PointSystemRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointHistory" ADD CONSTRAINT "PointHistory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
