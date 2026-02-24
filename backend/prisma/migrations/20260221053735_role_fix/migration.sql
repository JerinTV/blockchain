/*
  Warnings:

  - You are about to drop the column `batchId` on the `Batch` table. All the data in the column will be lost.
  - You are about to drop the column `batchSize` on the `Batch` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `Batch` table. All the data in the column will be lost.
  - You are about to drop the column `color` on the `Batch` table. All the data in the column will be lost.
  - You are about to drop the column `manufactureDate` on the `Batch` table. All the data in the column will be lost.
  - You are about to drop the column `manufacturePlace` on the `Batch` table. All the data in the column will be lost.
  - You are about to drop the column `productName` on the `Batch` table. All the data in the column will be lost.
  - You are about to drop the column `boxId` on the `Box` table. All the data in the column will be lost.
  - You are about to drop the column `retailerId` on the `Box` table. All the data in the column will be lost.
  - You are about to drop the column `shipped` on the `Box` table. All the data in the column will be lost.
  - You are about to drop the column `sold` on the `Box` table. All the data in the column will be lost.
  - You are about to drop the column `verified` on the `Box` table. All the data in the column will be lost.
  - You are about to drop the column `companyName` on the `Manufacturer` table. All the data in the column will be lost.
  - You are about to drop the column `contactEmail` on the `Manufacturer` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `Manufacturer` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `modelNumber` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `serialNumber` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `shipped` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `sold` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `verified` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `warranty` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `contactEmail` on the `Retailer` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `Retailer` table. All the data in the column will be lost.
  - You are about to drop the column `shopName` on the `Retailer` table. All the data in the column will be lost.
  - You are about to drop the column `username` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `ProductSecret` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[batchCode]` on the table `Batch` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[boxCode]` on the table `Box` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `Manufacturer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[productCode]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[qrHash]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `Retailer` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `batchCode` to the `Batch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalBoxes` to the `Batch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalProducts` to the `Batch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `boxCode` to the `Box` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalProducts` to the `Box` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Manufacturer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Manufacturer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `brand` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `category` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productCode` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Retailer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Retailer` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `role` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANUFACTURER', 'RETAILER');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('CREATED', 'SHIPPED', 'SOLD');

-- DropForeignKey
ALTER TABLE "Box" DROP CONSTRAINT "Box_retailerId_fkey";

-- DropIndex
DROP INDEX "Batch_batchId_key";

-- DropIndex
DROP INDEX "Box_boxId_key";

-- DropIndex
DROP INDEX "Product_productId_key";

-- DropIndex
DROP INDEX "User_username_key";

-- AlterTable
ALTER TABLE "Batch" DROP COLUMN "batchId",
DROP COLUMN "batchSize",
DROP COLUMN "category",
DROP COLUMN "color",
DROP COLUMN "manufactureDate",
DROP COLUMN "manufacturePlace",
DROP COLUMN "productName",
ADD COLUMN     "batchCode" TEXT NOT NULL,
ADD COLUMN     "totalBoxes" INTEGER NOT NULL,
ADD COLUMN     "totalProducts" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Box" DROP COLUMN "boxId",
DROP COLUMN "retailerId",
DROP COLUMN "shipped",
DROP COLUMN "sold",
DROP COLUMN "verified",
ADD COLUMN     "boxCode" TEXT NOT NULL,
ADD COLUMN     "totalProducts" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Manufacturer" DROP COLUMN "companyName",
DROP COLUMN "contactEmail",
DROP COLUMN "location",
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "userId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "image",
DROP COLUMN "modelNumber",
DROP COLUMN "price",
DROP COLUMN "productId",
DROP COLUMN "serialNumber",
DROP COLUMN "shipped",
DROP COLUMN "sold",
DROP COLUMN "verified",
DROP COLUMN "warranty",
ADD COLUMN     "blockchainHash" TEXT,
ADD COLUMN     "brand" TEXT NOT NULL,
ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "expDate" TIMESTAMP(3),
ADD COLUMN     "mfgDate" TIMESTAMP(3),
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "productCode" TEXT NOT NULL,
ADD COLUMN     "qrHash" TEXT,
ADD COLUMN     "status" "ProductStatus" NOT NULL DEFAULT 'CREATED';

-- AlterTable
ALTER TABLE "Retailer" DROP COLUMN "contactEmail",
DROP COLUMN "location",
DROP COLUMN "shopName",
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "userId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "username",
DROP COLUMN "role",
ADD COLUMN     "role" "Role" NOT NULL;

-- DropTable
DROP TABLE "ProductSecret";

-- CreateIndex
CREATE UNIQUE INDEX "Batch_batchCode_key" ON "Batch"("batchCode");

-- CreateIndex
CREATE UNIQUE INDEX "Box_boxCode_key" ON "Box"("boxCode");

-- CreateIndex
CREATE UNIQUE INDEX "Manufacturer_userId_key" ON "Manufacturer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_productCode_key" ON "Product"("productCode");

-- CreateIndex
CREATE UNIQUE INDEX "Product_qrHash_key" ON "Product"("qrHash");

-- CreateIndex
CREATE UNIQUE INDEX "Retailer_userId_key" ON "Retailer"("userId");

-- AddForeignKey
ALTER TABLE "Manufacturer" ADD CONSTRAINT "Manufacturer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retailer" ADD CONSTRAINT "Retailer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
