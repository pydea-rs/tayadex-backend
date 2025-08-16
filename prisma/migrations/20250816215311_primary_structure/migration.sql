-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('SWAP', 'MINT', 'BURN', 'TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "PointSystemRuleType" AS ENUM ('GENERAL', 'EVENT');

-- CreateEnum
CREATE TYPE "ReferralCriteriaModes" AS ENUM ('POINTS', 'TRANSACTIONS', 'SWAPS_ONLY', 'MINTS_ONLY');

-- CreateEnum
CREATE TYPE "ReferralRewardType" AS ENUM ('POINT', 'MON');

-- CreateTable
CREATE TABLE "Avatar" (
    "id" SERIAL NOT NULL,
    "asset" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Avatar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "address" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "avatar_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chain" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "rpc" TEXT NOT NULL,
    "last_indexed_block" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "Chain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedTransaction" (
    "id" BIGSERIAL NOT NULL,
    "hash" TEXT NOT NULL,
    "block_number" BIGINT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "token0" TEXT NOT NULL,
    "token1" TEXT,
    "token0_amount" DOUBLE PRECISION NOT NULL,
    "token1_amount" DOUBLE PRECISION,
    "type" "TransactionType" NOT NULL DEFAULT 'SWAP',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "user_id" INTEGER,
    "chain_id" INTEGER NOT NULL,

    CONSTRAINT "ProcessedTransaction_pkey" PRIMARY KEY ("id")
);

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
    "trx_id" BIGINT,
    "user_id" INTEGER,

    CONSTRAINT "PointHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referrer_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "layer" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("referrer_id","user_id")
);

-- CreateTable
CREATE TABLE "ReferralRules" (
    "id" SERIAL NOT NULL,
    "criteria" "ReferralCriteriaModes" NOT NULL DEFAULT 'POINTS',
    "criteria_token" TEXT,
    "activision_reward" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activision_reward_type" "ReferralRewardType" NOT NULL DEFAULT 'POINT',
    "direct_referral_ratio" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "direct_referral_type" "ReferralRewardType" NOT NULL DEFAULT 'POINT',
    "indirect_referral_ratio" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "indirect_referral_type" "ReferralRewardType" NOT NULL DEFAULT 'POINT',
    "devide_by_layer" BOOLEAN NOT NULL DEFAULT false,
    "last_payment_at" TIMESTAMP(3),

    CONSTRAINT "ReferralRules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_address_key" ON "User"("address");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_avatar_id_fkey" FOREIGN KEY ("avatar_id") REFERENCES "Avatar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessedTransaction" ADD CONSTRAINT "ProcessedTransaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessedTransaction" ADD CONSTRAINT "ProcessedTransaction_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "Chain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointHistory" ADD CONSTRAINT "PointHistory_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "PointSystemRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointHistory" ADD CONSTRAINT "PointHistory_trx_id_fkey" FOREIGN KEY ("trx_id") REFERENCES "ProcessedTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointHistory" ADD CONSTRAINT "PointHistory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
