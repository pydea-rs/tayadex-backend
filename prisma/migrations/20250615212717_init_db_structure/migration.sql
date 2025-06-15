-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('SWAP', 'MINT', 'BURN', 'TRANSFER', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" SERIAL NOT NULL,
    "number" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedTransaction" (
    "id" SERIAL NOT NULL,
    "hash" TEXT NOT NULL,
    "block_id" INTEGER NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "token0" TEXT NOT NULL,
    "token1" TEXT,
    "token0_amount" INTEGER NOT NULL,
    "token1_amount" INTEGER,
    "type" "TransactionType" NOT NULL DEFAULT 'SWAP',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "ProcessedTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_address_key" ON "User"("address");

-- CreateIndex
CREATE UNIQUE INDEX "Block_number_key" ON "Block"("number");

-- AddForeignKey
ALTER TABLE "ProcessedTransaction" ADD CONSTRAINT "ProcessedTransaction_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "Block"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
