-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatar_id" INTEGER;

-- CreateTable
CREATE TABLE "Avatar" (
    "id" SERIAL NOT NULL,
    "asset" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Avatar_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_avatar_id_fkey" FOREIGN KEY ("avatar_id") REFERENCES "Avatar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
