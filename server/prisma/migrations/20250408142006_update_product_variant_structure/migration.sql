/*
  Warnings:

  - You are about to drop the column `price` on the `ProductVariant` table. All the data in the column will be lost.
  - You are about to drop the column `size` on the `ProductVariant` table. All the data in the column will be lost.
  - You are about to drop the column `stock` on the `ProductVariant` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[productId,color]` on the table `ProductVariant` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sizePrices` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sizeStocks` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ProductVariant_productId_color_size_key";

-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN "price",
DROP COLUMN "size",
DROP COLUMN "stock",
ADD COLUMN     "sizePrices" JSONB NOT NULL,
ADD COLUMN     "sizeStocks" JSONB NOT NULL,
ADD COLUMN     "sizes" TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_color_key" ON "ProductVariant"("productId", "color");
